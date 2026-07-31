import type { Article, GeminiSummaryResult } from 'shared';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// 动态模型调度配置
export const MODEL_DRAFT = 'gemini-3.5-flash-lite'; // RPD: 500, RPM: 15 (初代摘要生成)
export const MODEL_DRAFT_FALLBACK = 'gemini-3.1-flash-lite'; // RPD: 500, RPM: 15 (初摘降级备用)
export const MODEL_REVIEW = 'gemma-4-31b'; // RPD: 14400, RPM: 30 (去 AI 味、通顺化主要审核模型)
export const MODEL_REVIEW_FALLBACK = 'gemini-3.5-flash-lite'; // RPD: 500 (审核备用模型)
export const MODEL_FEATURED_REVIEW = 'gemini-3.6-flash'; // RPD: 20, RPM: 5 (热门高分文章旗舰精修模型，受限配额)

const SYSTEM_PROMPT_DRAFT = `你是一位专业的 AI 技术新闻编辑，专注于 AI Coding、AI Agent、MCP 协议、大模型、开发工具等领域。受众是中国开发者和 AI 创业者。

【事实防错与准确性要求】：
1. 注意主流大模型的发展现状（目前已处于 Claude 5 世代、GPT-5 世代等）。
2. 严禁擅自给任何模型随意加上“最强”、“最新”、“刚发布”等绝对化或时效性修饰词。
3. 若原文讨论的是旧版本模型（如 Claude 3.5 Sonnet、GPT-4 等），摘要中必须清晰准确呈现其原本的版本名称或上下文，绝对不得将其误描绘或夸大为当前“最强/最新”模型。
4. 请保持客观中立，突出技术价值和实际影响，避免宣传套话。`;

const USER_PROMPT_DRAFT_TEMPLATE = (
  title: string,
  source: string,
  snippet: string,
) => `原文标题: ${title}
来源: ${source}
原文摘录（前4000字）: ${snippet}

请输出 JSON（不要有任何 markdown 代码块，直接输出纯 JSON）:
{
  "title_zh": "中文标题（20字以内，准确传达核心信息，严禁使用过时或夸大其词的‘最强/最新’修饰词）",
  "summary_zh": "中文摘要（分段或要点式，200-350字。请详细且完整地提炼原文的主要内容，包括核心技术实现、主要背景、关键结论或对开发者的实际影响，避免过于笼统或精简，注意事实中立性）",
  "category": "coding|agent|mcp|model|tool|news|funding|resource",
  "tags": ["最多5个英文小写标签，如 claude、mcp、cursor、gemini、openai"]
}`;

const SYSTEM_PROMPT_REVIEW = `你是一位严苛的技术资深主编。你的核心任务是消除 AI 文本中的“AI 味”，将其润色改写为自然、流畅、地道且干净的中技术短文。

【去 AI 味与重构准则】：
1. 【禁止套话】严禁使用“本文介绍了”、“总的来说”、“值得一提的是”、“这一重大突破”、“深入探讨了”等无意义的模板化开头与过渡句。直接切入核心技术事实。
2. 【禁止虚夸】彻底剔除“最强”、“颠覆性”、“革命性”、“前所未有”等吹捧和绝对化词汇，只保留具体数据与客观事实。
3. 【句式自然】将西式长难句重构为简洁有力的中文短句，动词精练，语言接地气，符合国内 AI 开发者与创业者的日常交流习惯。
4. 【排版规范】保持技术名词（如 Docker, MCP, Claude, GPT 等）原生写法与大写规范，要点清晰，无多余废话。`;

const USER_PROMPT_REVIEW_TEMPLATE = (
  draftTitleZh: string,
  draftSummaryZh: string,
  source: string,
) => `初始中文标题: ${draftTitleZh}
来源: ${source}
初始中文摘要: ${draftSummaryZh}

请对上述标题与摘要进行审阅与“去 AI 味”润色，使其更加自然顺畅。直接输出纯 JSON（不要 Markdown 代码块包裹）:
{
  "title_zh": "润色后的中文标题（20字以内，自然直接，无夸大套话）",
  "summary_zh": "润色后的中文摘要（200-350字，去 AI 味、无废话引言，自然顺畅的技术干货表达）"
}`;

export function sanitizeSummaryResult(result: GeminiSummaryResult): GeminiSummaryResult {
  if (!result) return result;

  let title = result.title_zh || '';
  let summary = result.summary_zh || '';

  // 擦除旧模型前面的“最强/最新”失实吹捧修饰短语
  const replacements: Array<[RegExp, string]> = [
    [/(?:Anthropic\s*旗下)?最强(?:的)?(?:大)?模型\s*(Claude\s*3(?:\.\d+)?(?:\s*\w+)?)/gi, '$1'],
    [/(?:OpenAI\s*旗下)?最强(?:的)?(?:大)?模型\s*(GPT-4[o]?)/gi, '$1'],
    [/(?:最新|最强)(?:发布)?(?:的)?(?:大)?模型\s*(Claude\s*3(?:\.\d+)?|GPT-4[o]?|Gemini\s*[12](?:\.\d+)?)/gi, '$1'],
    [/旗下最强模型\s*/g, '旗下的 '],
    [/最强模型\s*(Claude|GPT-3|GPT-4)/gi, '$1'],
    [/^本文介绍了/g, ''],
    [/^总的来说[，,]?/g, ''],
    [/值得注意的是[，,]?/g, ''],
  ];

  for (const [pattern, replacement] of replacements) {
    title = title.replace(pattern, replacement);
    summary = summary.replace(pattern, replacement);
  }

  return {
    ...result,
    title_zh: title.trim(),
    summary_zh: summary.trim(),
  };
}

/**
 * 阶段一：生成初代摘要（优先使用 Gemini 3.5 Flash Lite，RPD 500）
 */
export async function summarizeArticle(
  article: Pick<Article, 'title' | 'source' | 'content_raw'>,
  apiKey: string,
  useModel = MODEL_DRAFT,
): Promise<GeminiSummaryResult | null> {
  const snippet = (article.content_raw ?? '').slice(0, 4000);
  const prompt = USER_PROMPT_DRAFT_TEMPLATE(article.title, article.source, snippet);

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT_DRAFT }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/models/${useModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && useModel !== MODEL_DRAFT_FALLBACK) {
        await sleep(2000);
        return summarizeArticle(article, apiKey, MODEL_DRAFT_FALLBACK);
      }
      console.error(`Gemini summarize API error ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleanText) as GeminiSummaryResult;
    return sanitizeSummaryResult(parsed);
  } catch (err) {
    console.error('Gemini summarize error:', err);
    return null;
  }
}

/**
 * 阶段二：对摘要进行二次审核与去 AI 味润色
 * @param draft 初代摘要结果
 * @param source 文章来源
 * @param apiKey Gemini API 密钥
 * @param isFeatured 是否热门/高分文章
 */
export async function reviewAndPolishArticle(
  draft: GeminiSummaryResult,
  source: string,
  apiKey: string,
  isFeatured = false,
  useModel?: string,
): Promise<GeminiSummaryResult> {
  const modelToUse =
    useModel || (isFeatured ? MODEL_FEATURED_REVIEW : MODEL_REVIEW);

  const prompt = USER_PROMPT_REVIEW_TEMPLATE(
    draft.title_zh,
    draft.summary_zh,
    source,
  );

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT_REVIEW }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/models/${modelToUse}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      // 熔断与降级策略：如果高级审核模型超额(429)或出错，自动使用 MODEL_REVIEW_FALLBACK 润色
      if (modelToUse !== MODEL_REVIEW_FALLBACK) {
        console.warn(`Review model ${modelToUse} failed (${res.status}), fallback to ${MODEL_REVIEW_FALLBACK}`);
        await sleep(1500);
        return reviewAndPolishArticle(draft, source, apiKey, false, MODEL_REVIEW_FALLBACK);
      }
      // 如果回退模型仍然失败，保底返回初代摘要
      return draft;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleanText) as { title_zh?: string; summary_zh?: string };

    const mergedResult: GeminiSummaryResult = {
      ...draft,
      title_zh: parsed.title_zh || draft.title_zh,
      summary_zh: parsed.summary_zh || draft.summary_zh,
    };

    return sanitizeSummaryResult(mergedResult);
  } catch (err) {
    console.error(`Review error with model ${modelToUse}:`, err);
    // 保底：审核失败不中断发布，返回初代摘要
    return draft;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}


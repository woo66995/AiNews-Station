import type { Article, GeminiSummaryResult } from 'shared';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-3.5-flash';
const MODEL_FALLBACK = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `你是一位AI技术新闻编辑，专注于 AI Coding、AI Agent、MCP 协议、大模型、开发工具等领域。受众是中国开发者和 AI 创业者。请保持客观准确，突出技术价值和实际影响。`;

const USER_PROMPT_TEMPLATE = (
  title: string,
  source: string,
  snippet: string,
) => `原文标题: ${title}
来源: ${source}
原文摘录（前4000字）: ${snippet}

请输出 JSON（不要有任何 markdown 代码块，直接输出纯 JSON）:
{
  "title_zh": "中文标题（20字以内，准确传达核心信息）",
  "summary_zh": "中文摘要（分段或要点式，200-350字。请详细且完整地提炼原文的主要内容，包括核心技术实现、主要背景、关键结论或对开发者的实际影响，避免过于笼统或精简）",
  "category": "coding|agent|mcp|model|tool|news|funding|resource",
  "tags": ["最多5个英文小写标签，如 claude、mcp、cursor、gemini、openai"]
}`;

export async function summarizeArticle(
  article: Pick<Article, 'title' | 'source' | 'content_raw'>,
  apiKey: string,
  useModel = MODEL,
): Promise<GeminiSummaryResult | null> {
  const snippet = (article.content_raw ?? '').slice(0, 4000);
  const prompt = USER_PROMPT_TEMPLATE(article.title, article.source, snippet);

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
      // Try fallback model on 429 or 5xx
      if ((res.status === 429 || res.status >= 500) && useModel !== MODEL_FALLBACK) {
        await sleep(2000);
        return summarizeArticle(article, apiKey, MODEL_FALLBACK);
      }
      console.error(`Gemini API error ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleanText) as GeminiSummaryResult;
  } catch (err) {
    console.error('Gemini summarize error:', err);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

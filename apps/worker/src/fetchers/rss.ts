import type { Article, Source } from 'shared';

interface RSSSource {
  url: string;
  source: Source;
  limit?: number;
}

// All RSS sources with their configs
export const RSS_SOURCES: RSSSource[] = [
  { url: 'https://openai.com/news/rss.xml', source: 'openai', limit: 10 },
  { url: 'https://www.anthropic.com/rss.xml', source: 'anthropic', limit: 10 },
  { url: 'https://www.cursor.com/blog/rss.xml', source: 'cursor', limit: 10 },
  {
    url: 'https://www.reddit.com/r/LocalLLaMA/.rss?limit=30',
    source: 'reddit',
    limit: 20,
  },
  {
    url: 'https://www.reddit.com/r/MachineLearning/.rss?limit=20',
    source: 'reddit',
    limit: 10,
  },
  { url: 'https://www.v2ex.com/feed/tab/tech.xml', source: 'v2ex', limit: 15 },
  { url: 'https://linux.do/latest.rss', source: 'linuxdo', limit: 30 }, // Increased limit for linux.do
  {
    url: 'https://techcrunch.com/tag/artificial-intelligence/feed/',
    source: 'techcrunch',
    limit: 10,
  },
  {
    url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    source: 'theverge',
    limit: 10,
  },
];

// AI-related keywords for filtering non-dedicated feeds (reddit, v2ex, techcrunch, linuxdo)
const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'openai', 'anthropic', 'cursor',
  'copilot', 'agent', 'mcp', 'model', 'mistral', 'deepseek', 'coding',
  'transformer', 'diffusion', 'neural', 'machine learning', 'ml',
  'inference', 'embedding', 'rag', 'langchain', 'ollama', 'windsurf',
  'codeium', 'replit', 'token', 'prompt', 'fine-tun', 'vibe', 'agentic',
  '大模型', 'AI', '人工智能', '大语言', 'Claude', 'OpenAI', '模型',
  'api', '白嫖', '免费', '优惠', '额度', '降价', '福利', '注册教程',
  '折扣', '限免', '开源', '破解', '羊毛'
];

// Sources that don't need keyword filtering (dedicated AI blogs)
const DEDICATED_AI_SOURCES: Source[] = ['openai', 'anthropic', 'cursor'];

function needsFiltering(source: Source): boolean {
  return !DEDICATED_AI_SOURCES.includes(source);
}

function isAIRelated(text: string): boolean {
  return AI_KEYWORDS.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
}

function extractText(xml: string, tag: string): string {
  // Handle both <tag>content</tag> and CDATA
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = xml.match(plainRe);
  return plainMatch ? plainMatch[1].trim() : '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRSSItems(
  xml: string,
  source: Source,
  limit: number,
): Omit<Article, 'id' | 'summary_status'>[] {
  // Split on <item> or <entry> (Atom)
  const itemRe = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
  const results: Omit<Article, 'id' | 'summary_status'>[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null && results.length < limit) {
    const block = match[1];

    // Extract fields
    const title = stripHtml(
      extractText(block, 'title') || extractText(block, 'dc:title'),
    );
    if (!title) continue;

    // Link: try <link> tag, then href attribute in Atom <link>
    let url = extractText(block, 'link');
    if (!url) {
      const hrefMatch = block.match(/<link[^>]+href="([^"]+)"/i);
      url = hrefMatch?.[1] ?? '';
    }
    if (!url) continue;

    const description = stripHtml(
      extractText(block, 'description') ||
        extractText(block, 'content') ||
        extractText(block, 'summary'),
    ).slice(0, 600);

    const pubDate =
      extractText(block, 'pubDate') ||
      extractText(block, 'published') ||
      extractText(block, 'updated');
    const published_at = pubDate ? new Date(pubDate).toISOString() : undefined;

    // Filter out articles older than 7 days
    if (published_at) {
      const ageMs = Date.now() - new Date(published_at).getTime();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) continue;
    }

    // Filter non-dedicated sources
    const combinedText = `${title} ${description}`;
    if (needsFiltering(source) && !isAIRelated(combinedText)) continue;

    results.push({
      url,
      title,
      content_raw: description,
      source,
      score: 0,
      tags: [],
      published_at,
    });
  }

  return results;
}

export async function fetchRSSSource(
  rssSource: RSSSource,
): Promise<Omit<Article, 'id' | 'summary_status'>[]> {
  try {
    const res = await fetch(rssSource.url, {
      headers: { 'User-Agent': 'AiNews-Bot/1.0 (+https://ainews.pages.dev)' },
    });
    if (!res.ok) {
      console.error(`RSS fetch failed for ${rssSource.source}: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRSSItems(xml, rssSource.source, rssSource.limit ?? 20);
  } catch (err) {
    console.error(`RSS fetch error for ${rssSource.source}:`, err);
    return [];
  }
}

export async function fetchAllRSS(): Promise<Omit<Article, 'id' | 'summary_status'>[]> {
  const results = await Promise.all(RSS_SOURCES.map(fetchRSSSource));
  return results.flat();
}

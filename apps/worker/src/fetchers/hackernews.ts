import type { Article } from 'shared';

const HN_SEARCH = 'https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=50';

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'openai', 'anthropic', 'cursor',
  'copilot', 'agent', 'mcp', 'model', 'mistral', 'deepseek', 'coding',
  'transformer', 'diffusion', 'neural', 'machine learning', 'ml',
  'inference', 'embedding', 'rag', 'langchain', 'ollama', 'windsurf',
  'codeium', 'replit', 'token', 'prompt', 'fine-tun', 'vibe', 'agentic',
  'free', 'discount', 'credits', 'giveaway', 'open source', 'open-source'
];

function isAIRelated(title: string): boolean {
  const lower = title.toLowerCase();
  // match whole words to avoid matching "email" with "ml"
  return AI_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`);
    return regex.test(lower);
  });
}

export async function fetchHackerNews(limit = 30): Promise<Omit<Article, 'id' | 'summary_status'>[]> {
  try {
    const res = await fetch(HN_SEARCH);
    const data = await res.json() as any;
    
    const results: Omit<Article, 'id' | 'summary_status'>[] = [];
    
    for (const item of data.hits) {
      if (results.length >= limit) break;
      if (!isAIRelated(item.title)) continue;

      // Filter out articles older than 7 days
      if (item.created_at) {
        const ageMs = Date.now() - new Date(item.created_at).getTime();
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
        if (ageMs > maxAgeMs) continue;
      }

      const url = item.url ?? `https://news.ycombinator.com/item?id=${item.objectID}`;
      
      results.push({
        url,
        title: item.title,
        content_raw: item.story_text ?? item.title,
        source: 'hackernews',
        score: item.points ?? 0,
        tags: [],
        published_at: item.created_at,
      });
    }
    
    return results;
  } catch (err) {
    console.error('HN fetch error:', err);
    return [];
  }
}

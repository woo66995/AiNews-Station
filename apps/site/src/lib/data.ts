import type { Article, Category } from 'shared';

// In SSG mode, we fetch from D1 via the Cloudflare REST API at build time.
// At build time on Cloudflare Pages, DB is available via the adapter runtime.
// For local dev, we use a mock or wrangler's local D1.

export interface PagedArticles {
  articles: Article[];
  total: number;
}

export const CATEGORIES: { slug: Category; label: string; emoji: string }[] = [
  { slug: 'coding', label: 'AI 编程', emoji: '💻' },
  { slug: 'agent', label: 'AI Agent', emoji: '🤖' },
  { slug: 'mcp', label: 'MCP 协议', emoji: '🔌' },
  { slug: 'model', label: '模型动态', emoji: '🧠' },
  { slug: 'tool', label: '开发工具', emoji: '🛠️' },
  { slug: 'news', label: '行业资讯', emoji: '📰' },
  { slug: 'funding', label: '投融资', emoji: '💰' },
  { slug: 'resource', label: '羊毛福利', emoji: '🎁' },
];

export const SOURCE_LABELS: Record<string, string> = {
  hackernews: 'Hacker News',
  openai: 'OpenAI Blog',
  anthropic: 'Anthropic Blog',
  cursor: 'Cursor Blog',
  reddit: 'Reddit',
  v2ex: 'V2EX',
  linuxdo: 'LINUX DO',
  github: 'GitHub',
  techcrunch: 'TechCrunch',
  theverge: 'The Verge',
  minority: '少数派',
  other: '其他',
};

export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;

  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays} 天前`;

  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function parseTags(tagsJson: string | undefined): string[] {
  try {
    return JSON.parse(tagsJson ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function getCategoryInfo(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug) ?? { slug, label: slug, emoji: '📄' };
}

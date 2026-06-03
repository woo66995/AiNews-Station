export interface Article {
  id?: number;
  url: string;
  title: string;
  title_zh?: string;
  summary_zh?: string;
  content_raw?: string;
  source: Source;
  category?: Category;
  tags?: string[];
  score: number;
  slug?: string;
  summary_status: SummaryStatus;
  published_at?: string;
  fetched_at?: string;
  is_featured?: number;
}

export type Source =
  | 'hackernews'
  | 'openai'
  | 'anthropic'
  | 'reddit'
  | 'v2ex'
  | 'github'
  | 'cursor'
  | 'techcrunch'
  | 'theverge'
  | 'minority'
  | 'linuxdo'
  | 'other';

export type Category =
  | 'coding'
  | 'agent'
  | 'mcp'
  | 'model'
  | 'tool'
  | 'news'
  | 'funding'
  | 'resource';

export type SummaryStatus = 'pending' | 'done' | 'failed' | 'scheduled';

export interface GeminiSummaryResult {
  title_zh: string;
  summary_zh: string;
  category: Category;
  tags: string[];
}

export interface ModelData {
  id: string;
  name: string;
  vendor: string;
  vendorColor: string;
  logoUrl: string;
  context: string;
  inputPrice: string;
  outputPrice: string;
  released: string;
  arenaElo: number;
  strengths: string;
  coding: number;
  reasoning: number;
  knowledge: number;
  multimodal: number;
  speed: number;
  costEff: number;
}


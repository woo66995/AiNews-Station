import type { Article } from 'shared';

// At build time on Cloudflare Pages, fetch from the Worker's REST API.
// The Worker exposes /api/* endpoints for build-time data access.
// Set WORKER_API_URL in Cloudflare Pages env vars.

const WORKER_URL = import.meta.env.WORKER_API_URL ?? 'http://localhost:8787';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getArticles(opts?: {
  category?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}): Promise<{ articles: Article[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.category) params.set('category', opts.category);
  if (opts?.tag) params.set('tag', opts.tag);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return apiFetch<{ articles: Article[]; total: number }>(
    `/api/articles${qs ? `?${qs}` : ''}`,
  );
}

export async function getArticle(slug: string): Promise<Article | null> {
  try {
    return await apiFetch<Article>(`/api/articles/${slug}`);
  } catch {
    return null;
  }
}

export async function getAllSlugs(): Promise<string[]> {
  return apiFetch<string[]>('/api/slugs');
}

export async function getAllTags(): Promise<string[]> {
  return apiFetch<string[]>('/api/tags');
}

export async function getAllCategories(): Promise<string[]> {
  return apiFetch<string[]>('/api/categories');
}

export interface TrendItem {
  tag: string;
  count: number;
  prevCount: number;
  change: number;
}

export async function getTrends(): Promise<TrendItem[]> {
  try {
    return await apiFetch<TrendItem[]>('/api/trends');
  } catch {
    return [];
  }
}

export async function getRelatedArticles(slug: string): Promise<Article[]> {
  try {
    return await apiFetch<Article[]>(`/api/related/${slug}`);
  } catch {
    return [];
  }
}

export async function getDailyDigest(date?: string): Promise<{ date: string; articles: Article[] }> {
  try {
    const qs = date ? `?date=${date}` : '';
    return await apiFetch<{ date: string; articles: Article[] }>(`/api/daily${qs}`);
  } catch {
    return { date: date || new Date().toISOString().slice(0, 10), articles: [] };
  }
}

export async function getDailyArchives(): Promise<string[]> {
  try {
    return await apiFetch<string[]>('/api/daily-archives');
  } catch {
    return [];
  }
}

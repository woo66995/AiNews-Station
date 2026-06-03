import type { Article } from 'shared';
import { summarizeArticle } from '../ai/gemini';

const BATCH_SIZE = 10; // articles per summarize batch
const INTER_REQUEST_DELAY_MS = 5000; // 5000ms between Gemini calls to stay within free tier rate limit (~12 RPM)

export async function deduplicateArticles(
  db: D1Database,
  articles: Omit<Article, 'id' | 'summary_status'>[],
): Promise<Omit<Article, 'id' | 'summary_status'>[]> {
  if (articles.length === 0) return [];

  const urls = articles.map((a) => a.url);
  // Build parameterized query
  const placeholders = urls.map(() => '?').join(',');
  const existing = await db
    .prepare(`SELECT url FROM articles WHERE url IN (${placeholders})`)
    .bind(...urls)
    .all<{ url: string }>();

  const existingSet = new Set(existing.results.map((r) => r.url));
  return articles.filter((a) => !existingSet.has(a.url));
}

export async function insertPendingArticles(
  db: D1Database,
  articles: Omit<Article, 'id' | 'summary_status'>[],
): Promise<number[]> {
  const insertedIds: number[] = [];

  for (const article of articles) {
    try {
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO articles
           (url, title, content_raw, source, score, published_at, summary_status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        )
        .bind(
          article.url,
          article.title,
          article.content_raw ?? '',
          article.source,
          article.score,
          article.published_at ?? null,
        )
        .run();

      if (result.meta.last_row_id) {
        insertedIds.push(Number(result.meta.last_row_id));
      }
    } catch (err) {
      console.error(`Insert failed for ${article.url}:`, err);
    }
  }

  return insertedIds;
}

export async function processPendingArticles(
  db: D1Database,
  apiKey: string,
  maxBatch = BATCH_SIZE,
): Promise<{ processed: number; failed: number; articles: Article[] }> {
  const pending = await db
    .prepare(
      `SELECT id, title, source, content_raw, published_at, fetched_at FROM articles
       WHERE summary_status = 'pending'
       ORDER BY fetched_at DESC
       LIMIT ?`,
    )
    .bind(maxBatch)
    .all<Pick<Article, 'id' | 'title' | 'source' | 'content_raw' | 'published_at' | 'fetched_at'>>();

  let processed = 0;
  let failed = 0;
  const summarized: Article[] = [];

  for (const row of pending.results) {
    await sleep(INTER_REQUEST_DELAY_MS);

    const result = await summarizeArticle(
      { title: row.title, source: row.source, content_raw: row.content_raw },
      apiKey,
    );

    if (!result) {
      await db
        .prepare(`UPDATE articles SET summary_status = 'failed' WHERE id = ?`)
        .bind(row.id)
        .run();
      failed++;
      continue;
    }

    const slug = generateSlug(result.title_zh, row.id!, row.published_at ?? row.fetched_at);

    // Randomize publication time over the next 4 hours (the time until next fetch cycle)
    const delayMs = Math.floor(Math.random() * 4 * 60 * 60 * 1000);
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();

    await db
      .prepare(
        `UPDATE articles SET
          title_zh = ?, summary_zh = ?, category = ?,
          tags = ?, slug = ?, summary_status = 'scheduled',
          scheduled_at = ?
         WHERE id = ?`,
      )
      .bind(
        result.title_zh,
        result.summary_zh,
        result.category,
        JSON.stringify(result.tags),
        slug,
        scheduledAt,
        row.id,
      )
      .run();

    processed++;
  }

  // Articles are scheduled, they will be released by releaseScheduledArticles later.
  return { processed, failed, articles: [] };
}

export async function releaseScheduledArticles(db: D1Database): Promise<Article[]> {
  const now = new Date().toISOString();

  // Find all scheduled articles that are due
  const due = await db
    .prepare(`SELECT * FROM articles WHERE summary_status = 'scheduled' AND scheduled_at <= ?`)
    .bind(now)
    .all<Article>();

  if (due.results.length === 0) {
    return [];
  }

  const ids = due.results.map((a) => a.id).join(',');

  // Mark them as done so they appear on the site
  await db
    .prepare(`UPDATE articles SET summary_status = 'done' WHERE id IN (${ids})`)
    .run();

  return due.results;
}

function generateSlug(titleZh: string, id: number | undefined, dateStr?: string | null): string {
  const date = new Date(dateStr ?? Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
  // Keep ASCII chars, replace spaces/special chars with hyphens
  const ascii = titleZh
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  return `${date}-${ascii}-${id ?? 0}`;
}

export { generateSlug };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

import { fetchHackerNews } from './fetchers/hackernews';
import { fetchAllRSS } from './fetchers/rss';
import {
  deduplicateArticles,
  insertPendingArticles,
  processPendingArticles,
  releaseScheduledArticles,
} from './db/operations';
import { handleTelegramWebhook, pushNewArticles, pushDailyDigest } from './telegram';
import { handleApiRequest } from './api';

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  TG_BOT_TOKEN: string;
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Build-time data API for Astro SSG
    if (url.pathname.startsWith('/api/')) {
      const res = await handleApiRequest(url, env.DB);
      const headers = new Headers(res.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
      return new Response(res.body, { status: res.status, headers });
    }

    // Telegram Bot webhook
    if (req.method === 'POST' && url.pathname === '/tg') {
      return handleTelegramWebhook(req, env.TG_BOT_TOKEN, env.DB);
    }

    // Manual trigger for testing (GET /trigger?secret=xxx)
    if (req.method === 'GET' && url.pathname === '/trigger') {
      const secret = url.searchParams.get('secret');
      if (secret !== env.GEMINI_API_KEY.slice(0, 8)) {
        return new Response('Unauthorized', { status: 401 });
      }
      await runFetchCycle(env);
      return new Response('Fetch cycle completed', { status: 200 });
    }

    // Manual release trigger for testing (GET /release?secret=xxx)
    if (req.method === 'GET' && url.pathname === '/release') {
      const secret = url.searchParams.get('secret');
      if (secret !== env.GEMINI_API_KEY.slice(0, 8)) {
        return new Response('Unauthorized', { status: 401 });
      }
      await runReleaseCycle(env);
      return new Response('Release cycle completed', { status: 200 });
    }

    return new Response('AiNews Worker OK', { status: 200 });
  },

  // Cron handler
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    if (event.cron === '*/15 * * * *') {
      await runReleaseCycle(env);
    } else {
      await runFetchCycle(env);
    }
  },
};

async function runReleaseCycle(env: Env): Promise<void> {
  console.log('=== AiNews release cycle started ===');
  const released = await releaseScheduledArticles(env.DB);
  console.log(`Released ${released.length} articles`);

  if (env.TG_BOT_TOKEN && released.length > 0) {
    const pushable = released.filter(
      (a) => a.title_zh && a.summary_zh && a.url,
    ) as Array<{ title_zh: string; summary_zh: string; url: string; category?: string; tags?: string }>;

    if (pushable.length > 0) {
      await pushNewArticles(env.TG_BOT_TOKEN, env.DB, pushable);
    }
  }
}

async function runFetchCycle(env: Env): Promise<void> {
  console.log('=== AiNews fetch cycle started ===');

  // 1. Fetch from all sources
  const [hnArticles, rssArticles] = await Promise.all([
    fetchHackerNews(30).catch((e) => {
      console.error('HN fetch failed:', e);
      return [];
    }),
    fetchAllRSS().catch((e) => {
      console.error('RSS fetch failed:', e);
      return [];
    }),
  ]);

  const all = [...hnArticles, ...rssArticles];
  console.log(`Fetched ${all.length} articles total`);

  // 2. Deduplicate
  const newArticles = await deduplicateArticles(env.DB, all);
  console.log(`${newArticles.length} new articles after dedup`);

  // 3. Insert pending articles
  if (newArticles.length > 0) {
    await insertPendingArticles(env.DB, newArticles);
  }

  // 4. Process with Gemini (batch of 10 to stay within Worker CPU time)
  const { processed, failed, articles: summarized } =
    await processPendingArticles(env.DB, env.GEMINI_API_KEY, 10);
  console.log(`Summarized: ${processed} ok, ${failed} failed`);

  // 5. Daily digest notification (only push 2 times a day: Morning and Evening)
  if (env.TG_BOT_TOKEN && processed > 0) {
    const currentHour = new Date().getUTCHours();
    // UTC 0-1: 08:00 - 09:59 Beijing time (Morning)
    // UTC 12-13: 20:00 - 21:59 Beijing time (Evening)
    if (currentHour === 0 || currentHour === 1 || currentHour === 12 || currentHour === 13) {
      await pushDailyDigest(env.TG_BOT_TOKEN, env.DB, processed);
    }
  }

  console.log('=== AiNews fetch cycle completed ===');
}

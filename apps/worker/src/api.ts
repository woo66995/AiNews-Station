import type { Article } from 'shared';

export async function handleApiRequest(url: URL, db: D1Database): Promise<Response> {
  const path = url.pathname;

  try {
    if (path === '/api/articles') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
      const offset = Number(url.searchParams.get('offset') || 0);
      const category = url.searchParams.get('category');
      const tag = url.searchParams.get('tag');

      let query = `SELECT * FROM articles WHERE summary_status = 'done'`;
      const params: any[] = [];

      if (category) {
        query += ` AND category = ?`;
        params.push(category);
      }
      if (tag) {
        // Simple LIKE query for tags JSON array since D1 doesn't have native JSON querying yet
        query += ` AND tags LIKE ?`;
        params.push(`%"${tag}"%`);
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as c');
      const totalRes = await db.prepare(countQuery).bind(...params).first<{ c: number }>();

      query += ` ORDER BY COALESCE(scheduled_at, published_at, fetched_at) DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const articlesRes = await db.prepare(query).bind(...params).all<Article>();

      return new Response(JSON.stringify({
        articles: articlesRes.results,
        total: totalRes?.c || 0,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/api/articles/')) {
      const slug = path.split('/').pop();
      if (!slug) return new Response('Not found', { status: 404 });

      const article = await db.prepare(`SELECT * FROM articles WHERE slug = ?`)
        .bind(slug).first<Article>();

      if (!article) return new Response('Not found', { status: 404 });

      return new Response(JSON.stringify(article), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/slugs') {
      const res = await db.prepare(`SELECT slug FROM articles WHERE summary_status = 'done' AND slug IS NOT NULL`).all<{ slug: string }>();
      return new Response(JSON.stringify(res.results.map(r => r.slug)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/tags') {
      // In SQLite without json functions, we just return all tags and let the client process
      // But let's try to do it via JSON functions since D1 supports SQLite 3.38+
      try {
        const res = await db.prepare(`
          SELECT DISTINCT value as tag
          FROM articles, json_each(articles.tags)
          WHERE summary_status = 'done' AND tags != '[]'
        `).all<{ tag: string }>();
        return new Response(JSON.stringify(res.results.map(r => r.tag)), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        // Fallback if json_each fails
        const res = await db.prepare(`SELECT tags FROM articles WHERE summary_status = 'done' AND tags != '[]'`).all<{ tags: string }>();
        const allTags = new Set<string>();
        res.results.forEach(r => {
          try {
            const arr = JSON.parse(r.tags) as string[];
            arr.forEach(t => allTags.add(t));
          } catch {}
        });
        return new Response(JSON.stringify(Array.from(allTags)), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (path === '/api/categories') {
      const res = await db.prepare(`
        SELECT DISTINCT category FROM articles
        WHERE summary_status = 'done' AND category IS NOT NULL
      `).all<{ category: string }>();
      return new Response(JSON.stringify(res.results.map(r => r.category)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/trends') {
      try {
        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
        const d14 = new Date(now.getTime() - 14 * 86400000).toISOString();

        const recent = await db.prepare(`
          SELECT value as tag, COUNT(*) as count
          FROM articles, json_each(articles.tags)
          WHERE summary_status = 'done'
            AND tags != '[]'
            AND (published_at >= ? OR fetched_at >= ?)
          GROUP BY value ORDER BY count DESC LIMIT 15
        `).bind(d7, d7).all<{ tag: string; count: number }>();

        const prev = await db.prepare(`
          SELECT value as tag, COUNT(*) as count
          FROM articles, json_each(articles.tags)
          WHERE summary_status = 'done'
            AND tags != '[]'
            AND (published_at >= ? OR fetched_at >= ?)
            AND (published_at < ? OR fetched_at < ?)
          GROUP BY value ORDER BY count DESC LIMIT 30
        `).bind(d14, d14, d7, d7).all<{ tag: string; count: number }>();

        const prevMap = new Map(prev.results.map(r => [r.tag, r.count]));
        const trends = recent.results.map(r => {
          const prevCount = prevMap.get(r.tag) ?? 0;
          const change = prevCount === 0 ? 999 : Math.round(((r.count - prevCount) / prevCount) * 100);
          return { tag: r.tag, count: r.count, prevCount, change };
        });

        return new Response(JSON.stringify(trends), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        // Fallback in case D1 / SQLite lacks json_each
        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
        const d14 = new Date(now.getTime() - 14 * 86400000).toISOString();

        const articles = await db.prepare(`
          SELECT tags, published_at, fetched_at
          FROM articles
          WHERE summary_status = 'done'
            AND tags != '[]'
            AND (published_at >= ? OR fetched_at >= ?)
        `).bind(d14, d14).all<{ tags: string, published_at: string, fetched_at: string }>();

        const recentCounts = new Map<string, number>();
        const prevCounts = new Map<string, number>();

        articles.results.forEach(a => {
          const pub = a.published_at ?? a.fetched_at;
          const isRecent = pub >= d7;
          try {
            const tags = JSON.parse(a.tags) as string[];
            tags.forEach(t => {
              if (isRecent) {
                recentCounts.set(t, (recentCounts.get(t) ?? 0) + 1);
              } else {
                prevCounts.set(t, (prevCounts.get(t) ?? 0) + 1);
              }
            });
          } catch {}
        });

        const sortedRecent = Array.from(recentCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15);

        const trends = sortedRecent.map(([tag, count]) => {
          const prevCount = prevCounts.get(tag) ?? 0;
          const change = prevCount === 0 ? 999 : Math.round(((count - prevCount) / prevCount) * 100);
          return { tag, count, prevCount, change };
        });

        return new Response(JSON.stringify(trends), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (path.startsWith('/api/related/')) {
      const slug = path.replace('/api/related/', '');
      if (!slug) return new Response('Not found', { status: 404 });

      const current = await db.prepare(
        `SELECT tags FROM articles WHERE slug = ?`
      ).bind(slug).first<{ tags: string }>();

      if (!current || !current.tags) {
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let tags: string[] = [];
      try { tags = JSON.parse(current.tags); } catch {}

      if (tags.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Build LIKE query for tags
      const conditions = tags.map(() => `tags LIKE ?`).join(' OR ');
      const bindings = tags.map(t => `%"${t}"%`);

      const related = await db.prepare(
        `SELECT id, title_zh, title, slug, source, category, tags, published_at, fetched_at, scheduled_at
         FROM articles
         WHERE summary_status = 'done' AND slug != ? AND slug IS NOT NULL AND (${conditions})
         ORDER BY COALESCE(scheduled_at, published_at, fetched_at) DESC
         LIMIT 5`
      ).bind(slug, ...bindings).all<Article>();

      return new Response(JSON.stringify(related.results), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/daily') {
      const targetDate = url.searchParams.get('date');
      let res;
      let effectiveDate = targetDate || new Date().toISOString().slice(0, 10);

      if (targetDate) {
        // Fetch articles for a specific date (UTC date boundary for simplicity)
        const startOfDay = new Date(`${targetDate}T00:00:00Z`).toISOString();
        const endOfDay = new Date(`${targetDate}T23:59:59.999Z`).toISOString();

        res = await db.prepare(`
          SELECT id, title, title_zh, summary_zh, source, category, tags, score, slug, published_at, fetched_at, scheduled_at, url
          FROM articles
          WHERE summary_status = 'done'
            AND slug IS NOT NULL
            AND (
              (COALESCE(scheduled_at, published_at, fetched_at) >= ? AND COALESCE(scheduled_at, published_at, fetched_at) <= ?)
            )
          ORDER BY score DESC, COALESCE(scheduled_at, published_at, fetched_at) DESC
          LIMIT 30
        `).bind(startOfDay, endOfDay).all<Article>();
      } else {
        // Default behavior: last 48 hours, limit 15
        const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        res = await db.prepare(`
          SELECT id, title, title_zh, summary_zh, source, category, tags, score, slug, published_at, fetched_at, scheduled_at, url
          FROM articles
          WHERE summary_status = 'done'
            AND slug IS NOT NULL
            AND COALESCE(scheduled_at, published_at, fetched_at) >= ?
          ORDER BY score DESC, COALESCE(scheduled_at, published_at, fetched_at) DESC
          LIMIT 15
        `).bind(since).all<Article>();

        if (res.results.length === 0) {
          res = await db.prepare(`
            SELECT id, title, title_zh, summary_zh, source, category, tags, score, slug, published_at, fetched_at, scheduled_at, url
            FROM articles
            WHERE summary_status = 'done'
              AND slug IS NOT NULL
            ORDER BY COALESCE(scheduled_at, published_at, fetched_at) DESC
            LIMIT 15
          `).all<Article>();
        }
      }

      return new Response(JSON.stringify({
        date: effectiveDate,
        articles: res.results,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/daily-archives') {
      // Return a list of available dates (YYYY-MM-DD format) that have articles
      const res = await db.prepare(`
        SELECT DISTINCT substr(COALESCE(scheduled_at, published_at, fetched_at), 1, 10) as dateStr
        FROM articles
        WHERE summary_status = 'done'
        ORDER BY dateStr DESC
        LIMIT 30
      `).all<{ dateStr: string }>();

      return new Response(JSON.stringify(res.results.map(r => r.dateStr)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/models') {
      // Return list of models ordered by arenaElo DESC
      const res = await db.prepare(`SELECT * FROM models ORDER BY arenaElo DESC`).all<any>();
      return new Response(JSON.stringify(res.results), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  } catch (err) {
    console.error('API Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

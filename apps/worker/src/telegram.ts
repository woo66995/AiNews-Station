const TG_API = (token: string) => `https://api.telegram.org/bot${token}`;

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  try {
    await fetch(`${TG_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
  } catch (err) {
    console.error(`Telegram send error to ${chatId}:`, err);
  }
}

export async function handleTelegramWebhook(
  req: Request,
  token: string,
  db: D1Database,
): Promise<Response> {
  const body = (await req.json()) as {
    message?: {
      chat?: { id: number; username?: string };
      text?: string;
    };
  };

  const msg = body.message;
  if (!msg?.chat?.id || !msg.text) return new Response('ok');

  const chatId = String(msg.chat.id);
  const username = msg.chat.username ?? '';
  const text = msg.text.trim();

  if (text === '/start' || text === '/subscribe') {
    await db
      .prepare(
        `INSERT OR REPLACE INTO tg_subscribers (chat_id, username, active)
         VALUES (?, ?, 1)`,
      )
      .bind(chatId, username)
      .run();

    await sendTelegramMessage(
      token,
      chatId,
      `⚡ *AiNews AI 情报站* 订阅成功！\n\n自动推送最新 AI Coding / Agent / MCP 中文精选资讯，附带今日速览摘要。\n\n发送 /stop 取消订阅。`,
    );
  } else if (text === '/stop' || text === '/unsubscribe') {
    await db
      .prepare(`UPDATE tg_subscribers SET active = 0 WHERE chat_id = ?`)
      .bind(chatId)
      .run();

    await sendTelegramMessage(token, chatId, `已取消订阅。发送 /start 重新订阅。`);
  } else if (text === '/help') {
    await sendTelegramMessage(
      token,
      chatId,
      `⚡ *AiNews AI 情报站*\n\n/start — 订阅推送\n/daily — 今日速览\n/stop — 取消订阅\n/help — 查看帮助`,
    );
  } else if (text === '/daily') {
    await sendTelegramMessage(
      token,
      chatId,
      `📅 今日速览请访问：\nhttps://ainews.pages.dev/daily/\n\n自动更新精选 10-15 篇。`,
    );
  }

  return new Response('ok');
}

interface ArticleForPush {
  title_zh: string;
  summary_zh: string;
  url: string;
  category?: string;
  tags?: string;
}

function formatPushMessage(articles: ArticleForPush[]): string {
  const lines = articles.map((a) => {
    const tags = (() => {
      try {
        const parsed = JSON.parse(a.tags ?? '[]') as string[];
        return parsed.slice(0, 3).map((t) => `#${t}`).join(' ');
      } catch {
        return '';
      }
    })();
    return `📰 *${escapeMarkdown(a.title_zh)}*\n${escapeMarkdown(a.summary_zh)}\n${tags}\n[查看原文](${a.url})`;
  });

  return lines.join('\n\n---\n\n');
}

export async function pushDailyDigest(
  token: string,
  db: D1Database,
  articleCount: number,
): Promise<void> {
  if (articleCount === 0) return;

  const currentHour = new Date().getUTCHours();
  // UTC 0-11 -> Morning in Beijing (8:00 - 19:59)
  // UTC 12-23 -> Evening in Beijing (20:00 - 7:59)
  const isMorning = currentHour < 12;
  const periodStr = isMorning ? '🌞 早间简报' : '🌙 晚间汇总';

  const now = new Date().toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric',
  });

  const msg = `📅 *${now} AI 圈发生了什么？* \n\n${periodStr}已出炉，共 ${articleCount} 条精选动态。\n\n👉 [点击查看今日速览](https://ainews.pages.dev/daily/)`;

  // Push to official channel
  await sendTelegramMessage(token, '@ainews_Go', msg);
  await sleep(100);

  const subscribers = await db
    .prepare(`SELECT chat_id FROM tg_subscribers WHERE active = 1`)
    .all<{ chat_id: string }>();

  if (!subscribers.results.length) return;

  for (const sub of subscribers.results) {
    await sendTelegramMessage(token, sub.chat_id, msg);
    await sleep(100);
  }
}

function escapeMarkdown(text: string): string {
  // Only escape Markdown characters that strictly require escaping in standard Markdown mode.
  // Telegram has two modes: 'Markdown' and 'MarkdownV2'. We are using 'Markdown' (legacy)
  // in sendTelegramMessage, which only requires escaping _, *, `, and [.
  return text.replace(/([_*`\[])/g, '\\$1');
}

export async function pushNewArticles(
  token: string,
  db: D1Database,
  articles: ArticleForPush[],
): Promise<void> {
  if (articles.length === 0) return;

  // Split into batches of 5 articles to avoid message length limit
  const batchSize = 5;
  const batches: ArticleForPush[][] = [];
  for (let i = 0; i < articles.length; i += batchSize) {
    batches.push(articles.slice(i, i + batchSize));
  }

  // Push to official channel
  for (const batch of batches) {
    await sendTelegramMessage(token, '@ainews_Go', formatPushMessage(batch));
    await sleep(100);
  }

  const subscribers = await db
    .prepare(`SELECT chat_id FROM tg_subscribers WHERE active = 1`)
    .all<{ chat_id: string }>();

  if (!subscribers.results.length) return;

  for (const subscriber of subscribers.results) {
    for (const batch of batches) {
      await sendTelegramMessage(token, subscriber.chat_id, formatPushMessage(batch));
      await sleep(100); // rate limit: 30 messages/second per bot
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

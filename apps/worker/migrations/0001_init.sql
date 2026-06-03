-- 文章主表
CREATE TABLE IF NOT EXISTS articles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  url             TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  title_zh        TEXT,
  summary_zh      TEXT,
  content_raw     TEXT,
  source          TEXT NOT NULL,
  category        TEXT,
  tags            TEXT DEFAULT '[]',
  score           INTEGER DEFAULT 0,
  slug            TEXT,
  summary_status  TEXT NOT NULL DEFAULT 'pending',
  published_at    DATETIME,
  fetched_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_featured     INTEGER NOT NULL DEFAULT 0
);

-- Telegram 订阅者
CREATE TABLE IF NOT EXISTS tg_subscribers (
  chat_id       TEXT PRIMARY KEY,
  username      TEXT,
  subscribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active        INTEGER NOT NULL DEFAULT 1
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_articles_category   ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published  ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source     ON articles(source);
CREATE INDEX IF NOT EXISTS idx_articles_score      ON articles(score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug       ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status     ON articles(summary_status);
CREATE INDEX IF NOT EXISTS idx_articles_fetched    ON articles(fetched_at DESC);

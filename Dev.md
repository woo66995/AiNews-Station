# AiNews — 技术设计文档

> AI Coding / Agent / MCP 领域中文新闻聚合站  
> 面向中文开发者与 AI 创业者  
> 最后更新：2026-05-19

---

## 项目定位

每天自动聚合 AI Coding、AI Token 套餐、AI Agent、MCP、OpenAI、Claude Code 等领域最新新闻，自动生成中文摘要，发布为 SEO/GEO 友好的中文页面。

---

## 系统架构

```
Cron (每6h) → Worker 抓取多源 → 去重 → Gemini 生成摘要
                                               ↓
                              触发 Pages Deploy Hook
                                               ↓
                        Astro SSG 构建静态 HTML → CDN 全球分发
                                               ↓
                                 Telegram Bot 推送新文章摘要
```

---

## 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 前端框架 | Astro (SSG) | 纯静态 HTML 输出，SEO 最优；官方支持 Cloudflare Pages；零 JS 运行时 |
| 样式 | Tailwind CSS | 工具类 CSS，亮暗双模式支持原生；小体积 |
| 后端逻辑 | Cloudflare Workers (TypeScript) | 无服务器，Cron 原生支持，免费套餐充足 |
| 数据库 | Cloudflare D1 (SQLite) | Worker 同机房 <1ms 延迟；免费 5GB；零运维 |
| 缓存 | Cloudflare KV | 热门页快照；100k ops/天免费 |
| AI 摘要 | Google Gemini 2.5 Flash | 速度快；AI Studio 免费额度100万 token/天；中文质量好 |
| 定时任务 | Cloudflare Cron Triggers | Workers 内置，免费；无需外部调度服务 |
| 托管 | Cloudflare Pages | 全球 CDN；免费套餐500次构建/月 |
| 订阅推送 | Telegram Bot API | 实现简单（HTTP调用）；无服务器成本 |

### 为什么选 Astro 而不是 Next.js

- Cloudflare 官方 adapter（`@astrojs/cloudflare`），Next.js 需要第三方 `@opennextjs/cloudflare`
- 默认输出纯静态 HTML，SEO 完美，无 hydration 负担
- 构建速度快 3-5x
- Islands 架构：只有需要交互的组件才加载 JS（如主题切换按钮）

---

## Cloudflare 服务拆分

```
Cloudflare Pages          —— Astro 静态站托管（免费）
Cloudflare Workers        —— 抓取 + AI摘要 + 触发重建 + Telegram 推送
Cloudflare D1             —— 新闻主数据库（免费套餐）
Cloudflare KV             —— 首页快照缓存（可选，免费）
Cloudflare Cron Triggers  —— 每6小时调度（Workers 内置）
```

---

## 数据源矩阵

| 来源 | 语言 | 接入方式 | MVP 阶段 |
|------|------|---------|---------|
| Hacker News | 英 | 官方 JSON API | ✅ |
| OpenAI Blog | 英 | RSS | ✅ |
| Anthropic Blog | 英 | RSS | ✅ |
| Reddit r/LocalLLaMA | 英 | RSS | ✅ |
| Cursor Blog | 英 | RSS | ✅ |
| The Verge / TechCrunch (AI tag) | 英 | RSS | ✅ |
| V2EX (AI 节点) | 中 | RSS | ✅ |
| GitHub Trending (AI 筛选) | 英 | HTML 解析 | Week 3 |
| 少数派 | 中 | RSS | Week 3 |
| 知乎热榜 (AI) | 中 | RSS（需测试） | P1 |

**英文约 70%，中文约 30%（非硬性比例，以内容质量为准）**

---

## 数据库 Schema

```sql
-- 文章主表
CREATE TABLE articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT NOT NULL UNIQUE,      -- 去重键
  title         TEXT NOT NULL,             -- 原始标题
  title_zh      TEXT,                      -- AI 中文标题
  summary_zh    TEXT,                      -- AI 中文摘要（150字内）
  content_raw   TEXT,                      -- 原始内容片段（用于 AI 输入）
  source        TEXT NOT NULL,             -- 'hackernews'|'reddit'|'openai'等
  category      TEXT,                      -- 'coding'|'agent'|'mcp'|'model'|'tool'
  tags          TEXT,                      -- JSON 数组，如 ["claude","mcp","api"]
  score         INTEGER DEFAULT 0,         -- 原始热度分
  slug          TEXT,                      -- URL slug，如 2024-05-19-claude-mcp-1234
  summary_status TEXT DEFAULT 'pending',   -- 'pending'|'done'|'failed'
  published_at  DATETIME,
  fetched_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_featured   INTEGER DEFAULT 0
);

-- Telegram 订阅者
CREATE TABLE tg_subscribers (
  chat_id    TEXT PRIMARY KEY,
  username   TEXT,
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active     INTEGER DEFAULT 1
);

-- 索引
CREATE INDEX idx_articles_category    ON articles(category);
CREATE INDEX idx_articles_published   ON articles(published_at DESC);
CREATE INDEX idx_articles_source      ON articles(source);
CREATE INDEX idx_articles_score       ON articles(score DESC);
CREATE INDEX idx_articles_slug        ON articles(slug);
CREATE INDEX idx_articles_status      ON articles(summary_status);
```

---

## 数据流设计

### 每次抓取流程（每6小时）

```
1. Cron 触发 Worker
2. 并发抓取各数据源（每源约 30 条）
3. 批量去重：SELECT url FROM articles WHERE url IN (...)
4. 仅插入新文章（summary_status = 'pending'）
5. 逐篇调用 Gemini 生成摘要（间隔 500ms 防限速）
6. 更新 D1（title_zh, summary_zh, tags, category, slug, summary_status = 'done'）
7. 触发 Cloudflare Pages Deploy Hook（重建静态页面）
8. Telegram Bot 推送本次新增文章摘要（前10篇）
```

### 去重策略

- D1 `url UNIQUE` 约束（硬去重）
- Worker 层预检查，避免重复 AI 调用费用
- slug 按 `YYYYMMDD-{id}` 生成，保证唯一

---

## AI 摘要流程

**模型**: Gemini 2.5 Flash（`gemini-2.5-flash-preview-05-20`），降级 `gemini-1.5-flash`

**Prompt 设计**:

```
System: 你是一位AI技术新闻编辑，专注于 AI Coding、AI Agent、MCP 协议、大模型等领域。
        受众是中国开发者和 AI 创业者。

User:
原文标题: {title}
来源: {source}
原文摘录（前500字）: {content_snippet}

请输出 JSON（不要有任何 markdown 代码块）:
{
  "title_zh": "中文标题（20字以内，准确传达核心信息）",
  "summary_zh": "中文摘要（100-150字，要点式，面向开发者，突出技术价值）",
  "category": "coding|agent|mcp|model|tool|news|funding",
  "tags": ["最多5个标签，如 claude、mcp、cursor、gemini、openai"]
}
```

**成本估算**:
- 每篇约 600 tokens in + 200 tokens out ≈ 800 tokens
- 每次抓取约 30 篇新文章 × 800 = 24,000 tokens
- 每天 4 次 × 24,000 = 96,000 tokens/天
- AI Studio 免费额度：100万 tokens/天 → **月成本 ¥0**

---

## SEO 设计

### URL 结构

```
/                              首页（最新50篇）
/category/[category]/          分类页：coding / agent / mcp / model / tool
/article/[slug]/               文章详情页（AI摘要全文 + 原文弱化链接）
/tag/[tag]/                    标签聚合页
/sitemap.xml                   自动生成
/rss.xml                       RSS Feed（P1 阶段）
```

### 关键 SEO 元素

每篇文章页面：
- `<title>`: AI摘要标题 | AiNews
- `<meta name="description">`: AI摘要前80字
- `<meta og:title>` / `<meta og:description>`
- `<meta og:type content="article">`
- JSON-LD `NewsArticle` 结构化数据
- `<link rel="canonical">`
- 原文链接：弱化样式，但可点击（`rel="noopener"` + 灰色小字）

### GEO（AI 搜索引擎优化）

- 纯服务端渲染 HTML（零 JS 爬取障碍）
- 完整中文正文内容
- 语义化 HTML5 标签（`<article>`, `<header>`, `<time>`）
- 清晰的内容层级（Astro SSG 保证）

---

## 定时任务方案

```toml
# wrangler.toml
[triggers]
crons = ["0 0,6,12,18 * * *"]  # UTC 00:00 / 06:00 / 12:00 / 18:00
                                 # 对应北京时间 08:00 / 14:00 / 20:00 / 02:00
```

Worker 执行时间限制：
- 免费套餐：CPU 时间 10ms（实际调用等待不算）
- 抓取 + AI 分两个 Worker 或分批处理（每批10篇）
- 若 Worker 超时，下次 Cron 继续处理 `summary_status = 'pending'` 的文章

---

## Telegram Bot 订阅

**实现方案**:
- 用户发 `/start` → Worker 接收 webhook → 存 chat_id 到 D1
- 每次抓取完成后，推送本轮新增文章前10篇的标题+摘要+链接
- 格式：Markdown，一篇一条消息（避免消息过长）

```
📰 *Claude Code 新增 MCP 自定义工具支持*

Claude Code 现已支持开发者在本地配置自定义 MCP 工具，无需等待官方集成…

🔗 [查看原文](https://...) · #mcp #claude #coding
```

**技术实现**:
- Bot 注册：@BotFather 创建 Bot → 获取 Token
- Webhook：`https://api.telegram.org/bot{TOKEN}/setWebhook?url={WORKER_URL}/tg`
- Worker 路由：`POST /tg` 处理用户命令
- 推送：`sendMessage` API，每次新增后遍历 tg_subscribers 发送

---

## 亮暗双模式

- Tailwind CSS `darkMode: 'class'`
- 初始化：读取 `localStorage` → 写入 `<html class="dark">`（避免闪烁，inline script）
- 手动切换按钮（Astro Island，仅加载按钮组件的 JS）
- 自动跟随系统：`prefers-color-scheme` 媒体查询作为默认值

---

## 成本估算（月度）

| 服务 | 用量 | 费用 |
|------|------|------|
| Cloudflare Pages | ~120次构建/月（4次/天×30天） | 免费 |
| Cloudflare Workers | ~720次调用/月 | 免费（10万次/天额度） |
| Cloudflare D1 | <500MB 存储，<100万读/天 | 免费 |
| Cloudflare KV | <10万 ops/天 | 免费 |
| Google AI Studio | ~96k tokens/天 | **免费**（额度100万/天） |
| Telegram Bot API | 无限制 | **免费** |
| 域名（可选） | Cloudflare Registrar | ~¥70/年（约¥6/月） |

**MVP 月成本: ¥0**（域名可选）

---

## 项目目录结构

```
AiNews/
├── apps/
│   ├── worker/                # Cloudflare Worker
│   │   ├── src/
│   │   │   ├── index.ts       # Cron 入口 + Telegram webhook 路由
│   │   │   ├── fetchers/      # 各数据源抓取器
│   │   │   │   ├── hackernews.ts
│   │   │   │   ├── rss.ts     # 通用 RSS 解析器
│   │   │   │   └── github.ts  # GitHub Trending HTML 解析
│   │   │   ├── ai/
│   │   │   │   └── gemini.ts  # Gemini API 封装
│   │   │   ├── telegram.ts    # Bot 推送逻辑
│   │   │   └── db/
│   │   │       └── schema.sql # D1 建表 SQL
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── site/                  # Astro 静态站点
│       ├── src/
│       │   ├── pages/
│       │   │   ├── index.astro
│       │   │   ├── article/[slug].astro
│       │   │   ├── category/[category].astro
│       │   │   ├── tag/[tag].astro
│       │   │   └── sitemap.xml.ts
│       │   ├── layouts/
│       │   │   └── Base.astro
│       │   └── components/
│       │       ├── ArticleCard.astro
│       │       ├── ThemeToggle.astro  # Astro Island
│       │       └── CategoryNav.astro
│       ├── astro.config.mjs
│       └── package.json
├── Dev.md                     # 本文档
└── pnpm-workspace.yaml        # monorepo 配置
```

---

## MVP 开发路线

### Week 1：Worker + D1 骨架
- [ ] `pnpm init` + pnpm workspaces 配置
- [ ] Worker 项目初始化（wrangler init）
- [ ] D1 数据库创建 + schema 迁移
- [ ] 实现 Hacker News 抓取（官方 API）
- [ ] 接通 Gemini 2.5 Flash，验证摘要质量
- [ ] 手动运行测试，写入 D1 确认数据流通

### Week 2：Astro 站点
- [ ] Astro 项目初始化（Tailwind + Cloudflare adapter）
- [ ] 首页、分类页、文章详情页模板
- [ ] 亮暗双模式
- [ ] 部署到 Cloudflare Pages，绑定 D1

### Week 3：扩展数据源 + Telegram
- [ ] RSS 通用解析器（OpenAI / Anthropic / Reddit / V2EX）
- [ ] Pages Deploy Hook（抓取后自动重建）
- [ ] Telegram Bot 订阅 + 推送
- [ ] Cron Trigger 启用（每6小时）

### Week 4：SEO 完善
- [ ] sitemap.xml 自动生成
- [ ] JSON-LD `NewsArticle` 结构化数据
- [ ] OG 卡片 meta 标签
- [ ] 文章 slug 生成
- [ ] 性能验证（Lighthouse ≥ 90）

---

## 后期扩展（P1 / P2）

### P1（第2-3月）
- **热门排行**: 首页侧栏，按 `score DESC` 聚合，D1 原生支持
- **RSS Feed**: Astro 生成 `/rss.xml`，Cloudflare Pages 原生支持
- **GitHub Trending**: HTML 解析（cheerio / 正则），筛选 AI 相关 repo
- **少数派 / 知乎**: RSS 接入，验证反爬情况

### P2（第4月+）
- **全文搜索**: Cloudflare Vectorize（向量搜索）或 D1 FTS（SQLite 全文索引）
- **个性化推荐**: Gemini 根据用户浏览历史生成推荐摘要
- **多语言版本**: 英文版（吸引国际 SEO 流量）
- **评论系统**: D1 自建轻量评论（无第三方依赖）
- **知乎精选**: Cloudflare Browser Rendering（付费，$5/月）抓取动态页面

### 架构升级路径

```
日 PV > 10万: 开启 KV 缓存首页 + 热门文章快照（减少 D1 读压力）
日 PV > 100万: D1 只读副本 + Workers Analytics Engine 统计
文章量 > 10万: 全文搜索用 Cloudflare Vectorize（向量索引）
需要动态内容: 部分页面切换为 Astro SSR（Cloudflare adapter 支持混合模式）
```

---

## 关键风险 & 缓解

| 风险 | 缓解方案 |
|------|---------|
| Gemini API 限速（15 RPM） | 逐篇处理间隔 500ms；分批每批10篇 |
| Worker 30s 执行超时 | 抓取和 AI 摘要拆为独立逻辑，未完成的下次继续（status 字段） |
| RSS 源失效 | 多源冗余，单源失败不阻断整体流程（try/catch 隔离） |
| 知乎/少数派反爬 | MVP 阶段跳过；后期用 Browser Rendering 或第三方 RSS 桥接 |
| 内容重复 | D1 `url UNIQUE` + 预检去重，AI 摘要前确认 |
| Pages 构建超时 | Astro 静态构建速度快（<2min），正常情况不触发 |

---

## 环境变量

```
GEMINI_API_KEY        Google AI Studio API Key
TG_BOT_TOKEN          Telegram Bot Token（@BotFather 获取）
PAGES_DEPLOY_HOOK     Cloudflare Pages Deploy Hook URL
```

在 wrangler.toml 中通过 `[vars]` 或 `wrangler secret put` 管理。

---

## 参考资源

- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Astro Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Gemini API 文档](https://ai.google.dev/gemini-api/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

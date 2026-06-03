# ⚡ AiNews — 专为开发者打造的 AI 技术情报雷达

AiNews 是一个**全自动**的 AI 技术资讯聚合与智能摘要平台，专为中文开发者与 AI 创业者设计。

平台每天自动抓取全球顶尖 AI 科技源（如 Hacker News、Reddit、OpenAI、Anthropic、GitHub Trending 等），通过 Google Gemini 2.5 Flash 智能大模型提炼核心技术要点，并自动生成结构化、SEO 友好的中文摘要页面，同时支持 Telegram 订阅推送。

---

## 🌍 线上运行示例

* **官方演示网站**: [👉 https://ai.catclubs.cc](https://ai.catclubs.cc)
* **系统状态**: ⚡ 实时自动抓取 · 🤖 AI 智能提炼 · 🌓 亮暗双模式 · 🚀 全球 CDN 毫秒级响应
* **运营成本**: **¥ 0 元 / 月**（完全基于 Cloudflare + Google AI Studio 的免费生态！）

---

## 🌟 系统架构与亮点

本项目基于现代化的 Monorepo 架构开发，全量部署在 Cloudflare 免费生态中，保障了极高的稳定性和零维护成本：

```
                ┌─────────────────────────────────────────────────────────────┐
                │             Cloudflare Cron Triggers (每4小时)              │
                └──────────────┬──────────────────────────────┬───────────────┘
                               │ (触发)                       │ (15分钟发布检查)
                               ▼                              ▼
                ┌──────────────────────────────┐┌─────────────────────────────┐
                │     RSS Crawlers & APIs      ││    Scheduled Articles       │
                └──────────────┬───────────────┘└─────────────┬───────────────┘
                               │                              │ (定时发布)
                               ▼                              ▼
                ┌─────────────────────────────────────────────────────────────┐
                │            Cloudflare Workers (Backend Backend)             │
                │     - 去重拦截 (D1 UNIQUE)                                    │
                │     - 摘要提取 (Gemini 2.5 Flash API)                       │
                │     - 推送分发 (Telegram Bot API)                           │
                └──────────────┬──────────────────────────────┬───────────────┘
                               │ (读写)                       │ (调用)
                               ▼                              ▼
                ┌──────────────────────────────┐┌─────────────────────────────┐
                │     Cloudflare D1 (SQLite)   ││    Astro SSG/SSR Frontend   │
                │  持久化新闻、去重、订阅者列表   ││  部署于 Cloudflare Pages    │
                └──────────────────────────────┘└─────────────────────────────┘
```

### 💎 核心亮点
1. **极致性能 (Astro SSR)**: 基于 Astro 5 框架，采用 Cloudflare Pages SSR 模式运行。首屏纯静态 HTML 极速输出，无 JavaScript 水合 (Hydration) 负担，完美支持 SEO & GEO（AI 搜索引擎优化）。
2. **AI 智能加工**: 接入 Google Gemini 2.5 Flash，每天免费额度高达 100 万 token。通过精心调优的 System Prompt，自动完成翻译、技术术语矫正、分类归纳、关键词打标，并以纯 JSON 结构化格式入库。
3. **零门槛低成本运维**: D1 数据库直接绑定，Worker 与 D1 处于同机房，数据读取延迟 $< 1\text{ms}$。全站运行在 Cloudflare Free Tier，月度维护成本仅为 **0 元**。
4. **主动推送生态**: 内置 Telegram Webhook 机器人。每天清晨与黄昏定时将精选的 AI 简报与推送直达订阅用户，形成完整的主动/被动流量闭环。

---

## 💻 本地开发与“重设计”指南

如果您对本项目感兴趣，想将项目拉取到本地进行**界面重设计 (UI Redesign)**、**添加新的抓取源**或**修改 AI 摘要规则**，请参考以下指南：

### 1. 准备工作
本地开发需要安装以下环境：
* **Node.js**: `v20` 或更高版本
* **pnpm**: `v9` 或更高版本 (Monorepo 依赖管理)
* **Cloudflare Wrangler**: Cloudflare 官方 CLI 工具
* **Google AI Studio API Key**: [免费申请 Gemini API](https://aistudio.google.com/)

### 2. 克隆项目与安装依赖
```bash
# 1. 克隆仓库
git clone https://github.com/your-username/AiNews.git
cd AiNews

# 2. 安装 Monorepo 所有依赖
pnpm install
```

### 3. 本地数据库初始化 (SQLite)
本地开发环境将使用 Wrangler 自动在本地运行一个轻量级的 SQLite 数据库：
```bash
# 进入 worker 目录并应用 D1 本地数据库迁移
cd apps/worker
pnpm run db:migrate:local
```
这将会在本地创建 `articles` 和 `tg_subscribers` 两个表，并建立相应的索引。

### 4. 环境变量配置
在 Monorepo 对应的模块中配置环境变量：

#### ⚙️ 后端 Worker 配置
在 `apps/worker/.dev.vars` 中（如果没有则新建该文件），写入您的 Gemini 秘钥和 TG Bot 秘钥：
```env
GEMINI_API_KEY="您的_Google_AI_Studio_API_Key"
TG_BOT_TOKEN="您的_Telegram_Bot_Token"  # 可选，若不需要 TG 推送可留空
```

#### 🎨 前端 Astro 配置
在 `apps/site/.env.development` 中，指定本地 Worker API 的访问地址：
```env
WORKER_API_URL="http://localhost:8787"
```

### 5. 启动本地开发服务
在根目录下运行以下命令，将通过 pnpm filter 同时启动本地后端 Worker 和前端 Astro 静态渲染服务器：
```bash
# 终端同时运行前端 Astro 和后端 Worker
pnpm dev:worker   # 默认运行在 http://localhost:8787
pnpm dev:site     # 默认运行在 http://localhost:4321
```
打开浏览器访问 `http://localhost:4321`，您将看到系统界面。

### 6. 手动触发首次数据抓取
由于本地数据库是空的，您可以直接访问本地 Worker 的测试端点来手动触发抓取和 Gemini 摘要任务：
```text
http://localhost:8787/trigger?secret=YOUR_SECRET
```
> 💡 **提示**: 请将 `YOUR_SECRET` 替换为 `.dev.vars` 中配置的 `GEMINI_API_KEY` 的**前 8 位字符**。
>
> 访问后页面会处于加载状态（正在批量抓取 RSS 并请求 Gemini API），约 10~20 秒后显示 `Fetch cycle completed` 即说明数据抓取并写入本地 D1 数据库成功。再次刷新 `http://localhost:4321` 即可看到精美的 AI 技术新闻！

---

## 🎨 开发者如何进行“重设计 (Redesign)”？

本项目结构清晰，高度模块化。如果您希望在其基础上进行二次开发和定制化，可以从以下三个维度入手：

### A. 视觉与 UI 重设计 (Frontend Redesign)
前端完全使用 **Astro** 与 **Tailwind CSS** 构建。
* **修改公共样式/主题色**: 编辑 `apps/site/src/styles/global.css` 与 `apps/site/tailwind.config.mjs`。可以轻松修改品牌色 `brand-600`，调整亮暗双模式的视觉深度。
* **重构卡片布局**: 修改 `apps/site/src/components/ArticleCard.astro`。可以在此处增加“点赞”、“收藏”按钮，或者重新设计信息层级，如突出原始热度分（Score）和媒体源图标。
* **增加数据可视化**:
  * 项目内置了 `TagCloud.astro`（标签云）与 `TrendRadar.astro`（趋势雷达）。您可以使用 Chart.js、D3.js 或原生 SVG 重新设计趋势统计图，直观展示本周最火的 AI 关键词（如 `mcp`、`gemini`、`cursor`）。
* **增加动效**: 编辑 `apps/site/src/pages/index.astro` 中的快讯跑马灯样式，或通过 Tailwind 结合 `framer-motion` / `vanilla-js` 增加流畅的交互动效。

### B. 数据源与爬虫扩展 (Crawlers Extension)
抓取逻辑全在 `apps/worker/src/fetchers/` 目录中。
* **添加 RSS 订阅源**: 编辑 `apps/worker/src/fetchers/rss.ts`。在 `RSS_SOURCES` 数组中直接追加新的 XML 地址即可：
  ```typescript
  {
    name: 'techcrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'news'
  }
  ```
* **自定义网页解析器**: 如需抓取不提供 RSS 的动态网页，可参考 `apps/worker/src/fetchers/github.ts`，在后端使用正则或轻量 HTML 解析器解析出标题、链接和正文片段。

### C. 优化 AI 摘要与分类规则 (LLM Prompt Tuning)
Gemini 调优位于 `apps/worker/src/ai/gemini.ts` 或 `apps/worker/src/db/operations.ts` 中。
* **修改 Prompt**: 您可以优化 System Prompt，让 Gemini 翻译风格更贴近互联网黑话，或调整摘要字数（例如压缩到 50 字以内以做成“快报式”瀑布流）。
* **新增新闻类别**: 修改 `packages/shared/src/index.ts` 中的 `Category` 类型，并在 Prompt 中引导 Gemini 将新闻精准归类到您新增的类别（如：`hardware` 硬件、`security` 安全等）。

---

## 🚀 线上部署指南 (Cloudflare 全家桶)

当您完成本地重设计后，可以一键免费部署至 Cloudflare 线上环境：

### 1. 部署 D1 数据库
```bash
# 1. 在 Cloudflare 创建 D1 数据库
npx wrangler d1 create ainews-db

# 2. 复制控制台输出的 database_id，替换 apps/worker/wrangler.toml 中的 database_id

# 3. 将 D1 数据库的表结构同步到线上
cd apps/worker
npx wrangler d1 migrations apply ainews-db --remote
```

### 2. 部署后端 Worker
```bash
# 1. 写入线上环境变量秘钥 (Wrangler Secret)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put TG_BOT_TOKEN  # 可选

# 2. 部署 Worker
pnpm deploy:worker
```
部署成功后，请在 Cloudflare Workers 控制台的 **Triggers** 面板中确认 Cron Trigger 已自动生效。

### 3. 部署前端 Astro 站点到 Cloudflare Pages
1. 登录 Cloudflare 控制台 -> **Workers & Pages** -> **Create application** -> **Pages**。
2. 绑定您的 GitHub 仓库。
3. 构建设置如下：
   * **Framework preset**: `Astro`
   * **Build command**: `pnpm run build:site`
   * **Output directory**: `apps/site/dist`
   * **Root directory**: `(留空或设置为项目根目录)`
4. 在 Pages 环境变量中添加：
   * `WORKER_API_URL`: 您刚才部署的 Worker 的访问域名（例如 `https://ainews-worker.xxx.workers.dev`）。
5. 保存并部署。
6. (强烈建议) 配置 **Deploy Hook**:
   在 Pages 控制台 -> Settings -> Builds & deployments -> **Deploy hooks** 中创建 Webhook，并将其 URL 配置到 Worker 的秘钥 `PAGES_DEPLOY_HOOK` 中。这样每次 Worker 抓取到新内容后，都会自动触发 Pages 重新构建，确保静态页面永远是最新的！

---

## 📈 运营与维护成本估算

全量部署在 Cloudflare 免费套餐和 Google AI 免费层中，零运维负担：

| 服务组件 | 免费套餐限额 | 本项目实际用量 | 月度费用 |
| :--- | :--- | :--- | :--- |
| **Cloudflare Pages** | 不限流量 / 500 次构建/月 | 约 180 次构建/月（每 4 小时触发重构） | **¥ 0.00** |
| **Cloudflare Workers** | 100,000 次请求/天 | 约 1,000 次请求/天 | **¥ 0.00** |
| **Cloudflare D1** | 5GB 存储 / 500 万次读/天 | 约 50MB 存储 / 20 万次读/天 | **¥ 0.00** |
| **Google AI Studio** | 15 RPM / 100 万 token/天 | 约 300,000 token/天 | **¥ 0.00** |
| **Telegram Bot API** | 完全免费 | 约 100 次推送/天 | **¥ 0.00** |

💰 **总月度运营成本**: **¥ 0.00 元** (真正的用爱发电，完美无痛启动)

---

## 🤝 参与贡献

我们欢迎所有对 AI、Astro、Serverless 或者是网页重设计感兴趣的开发者参与贡献！
1. Fork 本项目
2. 创建您的 Feature 分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开一个 Pull Request

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

*如有任何问题或合作意向，欢迎访问示例网站 [https://ai.catclubs.cc](https://ai.catclubs.cc) 或提交 Issue！*

-- Create models table for comparison page
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  vendorColor TEXT NOT NULL,
  logoUrl TEXT NOT NULL,
  context TEXT NOT NULL,
  inputPrice TEXT NOT NULL,
  outputPrice TEXT NOT NULL,
  released TEXT NOT NULL,
  arenaElo INTEGER NOT NULL,
  strengths TEXT NOT NULL,
  coding INTEGER NOT NULL,
  reasoning INTEGER NOT NULL,
  knowledge INTEGER NOT NULL,
  multimodal INTEGER NOT NULL,
  speed INTEGER NOT NULL,
  costEff INTEGER NOT NULL
);

-- Insert model data for June 2026
INSERT OR REPLACE INTO models (id, name, vendor, vendorColor, logoUrl, context, inputPrice, outputPrice, released, arenaElo, strengths, coding, reasoning, knowledge, multimodal, speed, costEff) VALUES
('claude-opus-4-8', 'Claude Opus 4.8', 'Anthropic', '#CC785C', 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg', '200K', '$15/M', '$75/M', '2026-05', 1512, 'Anthropic 最新旗舰巅峰，全网最长思维链与最高代码智能，多模态大幅提升，当之无愧的王座', 100, 100, 98, 94, 40, 15),
('claude-opus-4-7-thinking', 'Claude Opus 4.7 Thinking', 'Anthropic', '#CC785C', 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg', '200K', '$15/M', '$75/M', '2026-04', 1500, '全球最强综合推理，Web Dev 冠军，长推理链王者', 98, 100, 95, 85, 35, 15),
('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'Anthropic', '#CC785C', 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg', '200K', '$3/M', '$15/M', '2025-12', 1467, '性价比之王，代码/WebDev双优，开发者日常首选', 93, 90, 88, 83, 75, 68),
('gpt-5.5-high', 'GPT-5.5 (High)', 'OpenAI', '#10a37f', 'https://api.iconify.design/logos:openai-icon.svg', '256K', '$15/M', '$60/M', '2026-03', 1481, 'OpenAI 旗舰，超长上下文，插件生态全球最丰富', 94, 93, 93, 90, 45, 18),
('llama-4.5-405b', 'Llama 4.5 (405B)', 'Meta', '#044E95', 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg', '512K', '$0.8/M', '$2.4/M', '2026-05', 1482, '全球最强开源超大参数模型，本地可部署，代码与多模态全面超越上一代', 92, 91, 94, 89, 50, 72),
('gemini-3-pro', 'Gemini 3.0 Pro', 'Google', '#4285f4', 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg', '2M', '$5/M', '$15/M', '2026-03', 1486, '2M 超长上下文，原生视频/音频多模态，Google 生态', 91, 92, 91, 94, 65, 55),
('gemini-3.5-flash', 'Gemini 3.5 Flash', 'Google', '#4285f4', 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg', '1M', '$0.5/M', '$2.5/M', '2026-05', 1480, '极高性价比与速度，百万上下文，多模态快思考', 90, 88, 89, 92, 88, 82),
('deepseek-v4-pro', 'DeepSeek V4 Pro', 'DeepSeek', '#5B6EF5', 'https://avatars.githubusercontent.com/u/148330874?s=200', '128K', '$0.55/M', '$2.2/M', '2025-11', 1456, '开源标杆，极致编码推理，中文优化，价格仅巨头 1/10', 92, 89, 87, 0, 82, 92),
('qwen3.7-max', 'Qwen3.7 Max', 'Alibaba (Qwen)', '#FF6A00', 'https://avatars.githubusercontent.com/u/141223081?s=200', '256K', '$0.5/M', '$2/M', '2026-04', 1463, '阿里最强，MoE 高效推理，多语言出色，开源生态活跃', 89, 88, 87, 0, 80, 93),
('glm-5.1', 'GLM 5.1', 'Zhipu AI (智谱)', '#2563EB', 'https://avatars.githubusercontent.com/u/128068098?s=200', '128K', '$0.7/M', '$2.8/M', '2026-02', 1471, '中国排名最高，WebDev Top5，文本理解与逻辑推理突出', 91, 90, 89, 78, 72, 70),
('kimi-k2.6', 'Kimi K2.6', 'Moonshot AI (月之暗面)', '#8B5CF6', 'https://avatars.githubusercontent.com/u/129677468?s=200', '128K', '$2/M', '$8/M', '2026-04', 1451, '国产长上下文先驱，Web Dev 强，视觉理解能力突出', 88, 87, 86, 80, 68, 55),
('mimo-v2.5-pro', 'MiMo V2.5 Pro', 'Xiaomi (小米)', '#FF6900', 'https://avatars.githubusercontent.com/u/13068227?s=200', '128K', '$1.2/M', '$4.8/M', '2026-01', 1465, '小米旗舰，多模态优异，性价比超群，手机端优化', 87, 86, 85, 88, 76, 60),
('ernie-5.1', 'ERNIE 5.1', 'Baidu (百度)', '#3B82F6', 'https://avatars.githubusercontent.com/u/12965840?s=200', '128K', '$1/M', '$4/M', '2026-02', 1473, '百度旗舰，搜索增强 + 知识图谱，中文理解深厚', 85, 87, 92, 76, 60, 58),
('minimax-m2.7', 'MiniMax M2.7', 'MiniMax (稀宇)', '#F59E0B', 'https://avatars.githubusercontent.com/u/103279624?s=200', '256K', '$0.3/M', '$1.2/M', '2025-12', 1420, '超低价格 + 256K 上下文，国产性价比黑马，语音合成强', 80, 82, 81, 72, 78, 90),
('hunyuan-hy3', 'Hunyuan HY3', 'Tencent (腾讯)', '#00C4FF', 'https://avatars.githubusercontent.com/u/18461506?s=200', '128K', '$0.8/M', '$2.4/M', '2025-12', 1418, '腾讯混元旗舰，企业微信/微信生态深度集成', 83, 84, 83, 74, 70, 65),
('grok-4.20', 'Grok 4.20', 'xAI (Elon Musk)', '#111111', 'https://avatars.githubusercontent.com/u/149570829?s=200', '128K', '$5/M', '$15/M', '2026-05', 1479, '实时搜索增强，思维链推理长，xAI 生态（X 深度整合）', 88, 91, 90, 82, 55, 40);

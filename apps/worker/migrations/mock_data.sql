INSERT INTO articles (url, title, title_zh, summary_zh, source, category, tags, score, slug, summary_status, published_at)
VALUES (
  'https://example.com/test-article',
  'Testing Claude Code MCP',
  '测试 Claude Code MCP 集成',
  'Claude Code 现在原生支持 MCP 协议了。开发者可以通过配置 settings.json 来集成自定义的本地工具，大大扩展了 AI 助手的边界。这个特性在 0.2 版本中正式可用。',
  'hackernews',
  'mcp',
  '["claude", "mcp", "tool"]',
  150,
  '20240519-ce-shi-claude-mcp-1',
  'done',
  '2024-05-19T10:00:00Z'
);

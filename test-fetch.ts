import { fetchHackerNews } from './apps/worker/src/fetchers/hackernews';
import { fetchAllRSS } from './apps/worker/src/fetchers/rss';

async function test() {
  console.log('Fetching Hacker News...');
  const hn = await fetchHackerNews(5);
  console.log(`Hacker News: fetched ${hn.length} articles`);

  console.log('Fetching all RSS...');
  const rss = await fetchAllRSS();
  console.log(`RSS: fetched ${rss.length} articles`);

  const counts: Record<string, number> = {};
  for (const item of rss) {
    counts[item.source] = (counts[item.source] ?? 0) + 1;
  }
  console.log('Articles per source:', counts);

  const linuxdoArticles = rss.filter(item => item.source === 'linuxdo');
  console.log(`linuxdo articles count: ${linuxdoArticles.length}`);
  if (linuxdoArticles.length > 0) {
    console.log('Sample linuxdo article:', linuxdoArticles[0]);
  }
}

test().catch(console.error);

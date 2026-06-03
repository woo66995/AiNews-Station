import type { APIRoute } from 'astro';
import { getAllSlugs, getAllCategories, getAllTags } from '../lib/api';

const SITE_URL = 'https://ainews.pages.dev';

export const GET: APIRoute = async () => {
  try {
    const [slugs, categories, tags] = await Promise.all([
      getAllSlugs(),
      getAllCategories(),
      getAllTags(),
    ]);

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>`;

    for (const cat of categories) {
      sitemap += `
  <url>
    <loc>${SITE_URL}/category/${cat}/</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    for (const tag of tags) {
      sitemap += `
  <url>
    <loc>${SITE_URL}/tag/${tag}/</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`;
    }

    for (const slug of slugs) {
      sitemap += `
  <url>
    <loc>${SITE_URL}/article/${slug}/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }

    sitemap += '\n</urlset>';

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
};

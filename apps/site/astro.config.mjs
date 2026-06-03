import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// SSR (server) output — pages fetch live data from Worker API at request time.
// Content updates in D1 are reflected immediately, no Pages rebuild needed.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',
  }),
  integrations: [tailwind()],
  site: 'https://ainews.pages.dev',
});

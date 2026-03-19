import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkRewriteLinks from './plugins/remark-rewrite-links.mjs';

export default defineConfig({
  site: 'https://rnagrodzki.github.io',
  base: '/sdlc-marketplace',
  output: 'static',
  integrations: [
    mdx(),
    sitemap(),
  ],
  markdown: {
    remarkPlugins: [remarkRewriteLinks],
  },
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
});

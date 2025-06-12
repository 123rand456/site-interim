// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeExternalLinks from 'rehype-external-links';
import remarkGfm from 'remark-gfm';
import { remarkReadingMetrics } from './src/utils/remarkReadingMetrics';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://123rand456.github.io/site-interim',
  base: '/site-interim/',
  integrations: [react(), tailwind(), sitemap()],
  output: 'server',

  markdown: {
    remarkPlugins: [remarkToc, remarkGfm, remarkReadingMetrics()],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeExternalLinks,
        { target: '_blank', rel: ['nofollow', 'noopener', 'noreferrer'] },
      ],
    ],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },

  adapter: vercel(),
});
// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeExternalLinks from 'rehype-external-links';
import remarkGfm from 'remark-gfm';
import { remarkReadingMetrics } from './src/utils/_remarkReadingMetrics';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  base: '/',
  output: 'server',
  integrations: [react(), tailwind(), sitemap()],
  adapter: vercel(),

  markdown: {
    remarkPlugins: [
      remarkToc,
      remarkGfm,
      // remarkReadingMetrics(),
    ],
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
});
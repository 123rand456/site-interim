import { getReadingMetrics } from './readingMetrics';
import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import type { RemarkPlugin } from '@astrojs/markdown-remark';
import { toString } from 'mdast-util-to-string';

export function remarkReadingMetrics(): RemarkPlugin {
  return function (tree: Root, file: VFile) {
    // Get content from the AST
    const content = toString(tree);
    const metrics = getReadingMetrics(content);

    // Initialize the data structure if it doesn't exist
    if (!file.data) {
      file.data = {};
    }

    // Initialize astro data if it doesn't exist
    if (!file.data.astro) {
      file.data.astro = {};
    }

    // Initialize frontmatter if it doesn't exist
    if (!file.data.astro.frontmatter) {
      file.data.astro.frontmatter = {};
    }

    // Add metrics to frontmatter
    file.data.astro.frontmatter.wordCount = metrics.wordCount;
    file.data.astro.frontmatter.readingTime = metrics.readTimeMinutes;
  };
}

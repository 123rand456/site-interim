import { getReadingMetrics } from './readingMetrics';
import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import type { RemarkPlugin } from '@astrojs/markdown-remark';
import { toString } from 'mdast-util-to-string';

export function remarkReadingMetrics(): RemarkPlugin {
  return function (tree: Root, vfile?: VFile) {
    // If vfile is undefined, we can't do anything
    if (!vfile) {
      return;
    }

    try {
      // Get content from the AST
      const content = toString(tree);
      const metrics = getReadingMetrics(content);

      // Create empty objects if they don't exist
      const data = (vfile.data = vfile.data || {});
      const astro = (data.astro = data.astro || {});
      const frontmatter = (astro.frontmatter = astro.frontmatter || {});

      // Add metrics to frontmatter
      frontmatter.wordCount = metrics.wordCount;
      frontmatter.readingTime = metrics.readTimeMinutes;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Ensure we at least have default values
      vfile.data = {
        astro: {
          frontmatter: {
            wordCount: 0,
            readingTime: 1,
          },
        },
      };
    }
  };
}

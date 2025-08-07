/// <reference types="astro/client" />
import rss from '@astrojs/rss';

export async function GET(context: any) {
  // Get all essays from the essays directory
  const posts = await Promise.all(
    Object.entries(import.meta.glob('./essays/*.md', { eager: true })).map(
      async entry => {
        const resolved = entry[1] as {
          url: string;
          frontmatter: any;
          rawContent: () => string;
        };

        const slug = entry[0].replace('./essays/', '').replace('.md', '');

        return {
          title: resolved.frontmatter.title,
          description: resolved.frontmatter.description,
          pubDate: new Date(
            resolved.frontmatter.dateUpdated || resolved.frontmatter.dateCreated
          ),
          link: `/essays/${slug}/`,
          content:
            typeof resolved.rawContent === 'function'
              ? resolved.rawContent()
              : '',
          categories: [
            resolved.frontmatter.category,
            ...(resolved.frontmatter.tags || []),
          ],
          author: 'Chizubo',
        };
      }
    )
  );

  // Sort posts by publication date (newest first)
  posts.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: "Chizubo's Essays and Research",
    description:
      'A collection of essays on technology, science, and philosophy.',
    site: context.site || 'https://mienstream.com',
    items: posts.map(post => ({
      title: post.title,
      description: post.description,
      pubDate: post.pubDate,
      link: post.link,
      content: post.content,
      categories: post.categories,
      author: post.author,
    })),
    customData: `<language>en-us</language>`,
  });
}

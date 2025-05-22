import 'dotenv/config';
import algoliasearch from 'algoliasearch';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME;

if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY || !ALGOLIA_INDEX_NAME) {
  console.error('Please set ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY, and ALGOLIA_INDEX_NAME in your environment.');
  process.exit(1);
}

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = client.initIndex(ALGOLIA_INDEX_NAME);

const essaysDir = path.resolve('src/pages/essays');

async function getEssays() {
  const files = await fs.readdir(essaysDir);
  const essays = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(essaysDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    const { data, content: body } = matter(content);
    const slug = file.replace('.md', '');
    essays.push({
      objectID: slug,
      slug,
      title: data.title,
      description: data.description,
      category: data.category,
      date: data.dateUpdated || data.dateCreated || data.date,
      tags: data.tags || [],
      body: body.slice(0, 500), // Optionally index first 500 chars
    });
  }
  return essays;
}

async function main() {
  const essays = await getEssays();
  await index.saveObjects(essays);
  console.log(`Indexed ${essays.length} essays to Algolia.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 
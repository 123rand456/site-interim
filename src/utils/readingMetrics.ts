/**
 * Calculate reading metrics for a given text
 * @param text - The markdown text to analyze
 * @returns Object containing word count and estimate read time
 */

interface ReadingMetrics {
  wordCount: number;
  readTimeMinutes: number;
}

const AVG_WORDS_READ_PER_MINUTE = 200;

function cleanMarkdownText(text: string): string {
  return text
    .replace(/---[\s\S]*?---/, '') // Remove frontmatter
    .replace(/^#+\s/gm, '') // Remove header markers but keep text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Replace links with just text
    .replace(/[*_`~]/g, '') // Remove formatting characters
    .replace(/^\s*[-*+]\s/gm, '') // Remove list markers but keep text
    .replace(/^\s*\d+\.\s/gm, '') // Remove numbered list markers but keep text
    .replace(/^\s*>/gm, '') // Remove blockquote markers but keep text
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\[\^.+?\]/g, '') // Remove footnote references
    .trim();
}

export function getReadingMetrics(text: string): ReadingMetrics {
  const cleanText = cleanMarkdownText(text);
  const words = cleanText.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  const readTimeMinutes = Math.max(
    1,
    Math.ceil(wordCount / AVG_WORDS_READ_PER_MINUTE)
  );

  return {
    wordCount,
    readTimeMinutes,
  };
}

/**
 * Format reading metrics
 * @param metrics - Reading metric object
 * @returns Formatted string
 */
export function formatReadingMetrics(metrics: ReadingMetrics): string {
  const formattedWordCount = (metrics.wordCount ?? 0).toLocaleString();
  return `${formattedWordCount} words · ${metrics.readTimeMinutes} min read`;
}

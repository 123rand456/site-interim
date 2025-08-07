import { supabase } from './supabase';

export interface ContentStats {
  page_path: string;
  total_views: number;
  unique_views: number;
  average_reading_time_seconds: number;
  average_scroll_depth_percent: number;
}

// Get view counts for multiple pages (for essay lists)
export async function getContentStats(
  pagePaths: string[]
): Promise<Record<string, ContentStats>> {
  try {
    const { data, error } = await supabase
      .from('content_analytics')
      .select('*')
      .in('content_path', pagePaths);

    if (error) {
      console.error('Failed to fetch content stats:', error);
      return {};
    }

    // Convert array to object for easy lookup
    const statsMap: Record<string, ContentStats> = {};
    data?.forEach(stat => {
      statsMap[stat.content_path] = {
        page_path: stat.content_path,
        total_views: stat.total_views || 0,
        unique_views: stat.unique_views || 0,
        average_reading_time_seconds: stat.average_reading_time_seconds || 0,
        average_scroll_depth_percent: stat.average_scroll_depth_percent || 0,
      };
    });

    return statsMap;
  } catch (error) {
    console.error('Error fetching content stats:', error);
    return {};
  }
}

// Get stats for a single page
export async function getSingleContentStats(
  pagePath: string
): Promise<ContentStats | null> {
  try {
    const { data, error } = await supabase
      .from('content_analytics')
      .select('*')
      .eq('content_path', pagePath)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      page_path: data.content_path,
      total_views: data.total_views || 0,
      unique_views: data.unique_views || 0,
      average_reading_time_seconds: data.average_reading_time_seconds || 0,
      average_scroll_depth_percent: data.average_scroll_depth_percent || 0,
    };
  } catch (error) {
    console.error('Error fetching single content stats:', error);
    return null;
  }
}

// Format reading time for display
export function formatReadingTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
}

// Format view count for display
export function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

import React, { useState, useEffect } from 'react';
import {
  getSingleContentStats,
  formatViewCount,
  formatReadingTime,
  type ContentStats,
} from '../utils/content-analytics';

interface EssayStatsDisplayProps {
  essayPath: string;
  className?: string;
  showDetailed?: boolean;
}

export default function EssayStatsDisplay({
  essayPath,
  className = '',
  showDetailed = false,
}: EssayStatsDisplayProps) {
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const contentStats = await getSingleContentStats(essayPath);
        setStats(contentStats);
      } catch {
        console.error('Failed to fetch essay stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [essayPath]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  // Show "New" badge if no views yet
  if (!stats || stats.total_views === 0) {
    return (
      <div className={`text-xs text-blue-600 dark:text-blue-400 ${className}`}>
        New
      </div>
    );
  }

  if (showDetailed) {
    return (
      <div className={`text-sm text-gray-600 space-y-1 ${className}`}>
        <div className="flex items-center space-x-4">
          <span>{formatViewCount(stats.total_views)} views</span>
          {stats.average_reading_time_seconds > 0 && (
            <span>
              {formatReadingTime(stats.average_reading_time_seconds)} avg read
            </span>
          )}
          {stats.average_scroll_depth_percent > 0 && (
            <span>{stats.average_scroll_depth_percent}% completion</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      {formatViewCount(stats.total_views)} views
    </div>
  );
}

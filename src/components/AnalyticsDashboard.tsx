import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { Card } from './ui/Card';

interface AnalyticsData {
  totalPageViews: number;
  uniqueVisitors: number;
  topPages: Array<{
    page_path: string;
    total_views: number;
    unique_views: number;
    avg_reading_time: number;
    avg_scroll_depth: number;
  }>;
  recentSearches: Array<{
    query: string;
    results_count: number;
    created_at: string;
  }>;
  engagementMetrics: {
    avgReadingTime: number;
    avgScrollDepth: number;
    completionRate: number;
  };
  dailyViews: Array<{
    date: string;
    views: number;
  }>;
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(
        endDate.getDate() -
          (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90)
      );

      // Parallel fetch of all analytics data
      const [
        pageViewsResult,
        topPagesResult,
        searchQueriesResult,
        engagementResult,
        dailyViewsResult,
      ] = await Promise.all([
        // Total page views and unique visitors
        supabase
          .from('page_views')
          .select('session_id')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),

        // Top pages with analytics
        supabase
          .from('content_analytics')
          .select('*')
          .order('total_views', { ascending: false })
          .limit(10),

        // Recent search queries
        supabase
          .from('search_queries')
          .select('query, results_count, created_at')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(20),

        // Engagement metrics
        supabase
          .from('reading_sessions')
          .select('reading_time_seconds, scroll_depth_percent, completed')
          .gte('started_at', startDate.toISOString())
          .gt('reading_time_seconds', 10), // Filter out quick bounces

        // Daily views for chart
        supabase.rpc('get_daily_views', {
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0],
        }),
      ]);

      if (pageViewsResult.error) throw pageViewsResult.error;
      if (topPagesResult.error) throw topPagesResult.error;
      if (searchQueriesResult.error) throw searchQueriesResult.error;
      if (engagementResult.error) throw engagementResult.error;

      // Process the data
      const uniqueVisitors = new Set(
        pageViewsResult.data?.map(pv => pv.session_id)
      ).size;
      const totalPageViews = pageViewsResult.data?.length || 0;

      const engagementData = engagementResult.data || [];
      const avgReadingTime =
        engagementData.length > 0
          ? Math.round(
              engagementData.reduce(
                (sum, session) => sum + (session.reading_time_seconds || 0),
                0
              ) / engagementData.length
            )
          : 0;

      const avgScrollDepth =
        engagementData.length > 0
          ? Math.round(
              engagementData.reduce(
                (sum, session) => sum + (session.scroll_depth_percent || 0),
                0
              ) / engagementData.length
            )
          : 0;

      const completionRate =
        engagementData.length > 0
          ? Math.round(
              (engagementData.filter(session => session.completed).length /
                engagementData.length) *
                100
            )
          : 0;

      setAnalytics({
        totalPageViews,
        uniqueVisitors,
        topPages:
          topPagesResult.data?.map(page => ({
            page_path: page.content_path,
            total_views: page.total_views,
            unique_views: page.unique_views,
            avg_reading_time: page.average_reading_time_seconds || 0,
            avg_scroll_depth: page.average_scroll_depth_percent || 0,
          })) || [],
        recentSearches:
          searchQueriesResult.data?.map(search => ({
            query: search.query,
            results_count: search.results_count,
            created_at: search.created_at,
          })) || [],
        engagementMetrics: {
          avgReadingTime,
          avgScrollDepth,
          completionRate,
        },
        dailyViews: dailyViewsResult.data || [],
      });
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch analytics'
      );
    } finally {
      setLoading(false);
    }
  }, [timeRange]); // Only depend on timeRange

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  };

  const getPageTitle = (path: string): string => {
    if (path === '/') return 'Homepage';
    if (path.startsWith('/essays/')) {
      const slug = path.replace('/essays/', '').replace('/', '');
      return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return path.replace('/', '').charAt(0).toUpperCase() + path.slice(2);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <h3 className="text-red-800 font-medium">Error loading analytics</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <select
          value={timeRange}
          onChange={e => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
          className="border border-gray-300 rounded px-3 py-1 text-sm"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600">
            Total Page Views
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.totalPageViews.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600">Unique Visitors</h3>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.uniqueVisitors.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600">
            Avg Reading Time
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatDuration(analytics.engagementMetrics.avgReadingTime)}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600">Completion Rate</h3>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.engagementMetrics.completionRate}%
          </p>
        </Card>
      </div>

      {/* Top Pages */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
        <div className="space-y-3">
          {analytics.topPages.map((page, _index) => (
            <div
              key={page.page_path}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">
                  {getPageTitle(page.page_path)}
                </h4>
                <p className="text-sm text-gray-500">{page.page_path}</p>
              </div>
              <div className="flex space-x-4 text-sm text-gray-600">
                <span>{page.total_views} views</span>
                <span>{formatDuration(page.avg_reading_time)}</span>
                <span>{page.avg_scroll_depth}% scroll</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Searches */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Searches</h3>
        <div className="space-y-2">
          {analytics.recentSearches.slice(0, 10).map((search, _index) => (
            <div
              key={_index}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <span className="font-medium">{search.query}</span>
              <div className="flex space-x-3 text-sm text-gray-600">
                <span>{search.results_count} results</span>
                <span>{new Date(search.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Engagement Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Engagement Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {formatDuration(analytics.engagementMetrics.avgReadingTime)}
            </p>
            <p className="text-sm text-gray-600">Average Reading Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {analytics.engagementMetrics.avgScrollDepth}%
            </p>
            <p className="text-sm text-gray-600">Average Scroll Depth</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {analytics.engagementMetrics.completionRate}%
            </p>
            <p className="text-sm text-gray-600">Completion Rate</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

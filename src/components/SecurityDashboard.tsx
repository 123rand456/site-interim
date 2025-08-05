import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

// TypeScript interfaces for type safety
interface SecurityEvent {
  id: string;
  event_type: string;
  identifier: string | null;
  details: Record<string, any> | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
  created_at: string;
}

interface RateLimit {
  id: string;
  identifier: string;
  action_type: string;
  count: number;
  window_start: string;
  created_at: string;
  updated_at: string;
}

interface EventStats {
  [eventType: string]: number;
}

interface RateLimitStats {
  [actionType: string]: number;
}

export default function SecurityDashboard() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [rateLimitStats, setRateLimitStats] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSecurityData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSecurityData = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Get recent security events (last 7 days)
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      const { data: events, error: eventsError } = await supabase
        .from('security_events')
        .select('*')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) {
        console.warn('Security events error:', eventsError);
        setSecurityEvents([]);
      } else {
        setSecurityEvents(events || []);
      }

      // Get rate limit statistics (last 24 hours)
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();
      const { data: rateStats, error: rateError } = await supabase
        .from('rate_limits')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(100);

      if (rateError) {
        console.warn('Rate limits error:', rateError);
        setRateLimitStats([]);
      } else {
        setRateLimitStats(rateStats || []);
      }
    } catch (err: any) {
      setError(`Failed to load security data: ${err.message}`);
      console.error('Error loading security data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Process stats for display with proper typing
  const eventStats: EventStats = securityEvents.reduce(
    (acc: EventStats, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    },
    {}
  );

  const rateLimitsByAction: RateLimitStats = rateLimitStats.reduce(
    (acc: RateLimitStats, limit) => {
      acc[limit.action_type] = (acc[limit.action_type] || 0) + limit.count;
      return acc;
    },
    {}
  );

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityColor = (severity: SecurityEvent['severity']): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'error':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">
          Loading security data...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={loadSecurityData}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">
            Security Events (7 days)
          </h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {securityEvents.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total events logged</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Rate Limit Hits (24h)</h3>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {
              rateLimitStats.filter(r => r.action_type === 'comment_submit')
                .length
            }
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Comment submissions blocked
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Failed Auth Attempts</h3>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            {securityEvents.filter(e => e.event_type === 'failed_auth').length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Authentication failures</p>
        </div>
      </div>

      {/* Event Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Security Event Types</h3>
          {Object.keys(eventStats).length === 0 ? (
            <p className="text-gray-500 italic">
              No security events in the last 7 days
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(eventStats).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Rate Limit Activity</h3>
          {Object.keys(rateLimitsByAction).length === 0 ? (
            <p className="text-gray-500 italic">
              No rate limiting activity in the last 24 hours
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(rateLimitsByAction).map(([action, count]) => (
                <div key={action} className="flex justify-between items-center">
                  <span className="capitalize">
                    {action.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Security Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Recent Security Events</h3>

        {securityEvents.length === 0 ? (
          <p className="text-gray-500 italic">No security events to display</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-3">Timestamp</th>
                  <th className="text-left py-2 px-3">Event Type</th>
                  <th className="text-left py-2 px-3">Severity</th>
                  <th className="text-left py-2 px-3">Identifier</th>
                  <th className="text-left py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map(event => (
                  <tr
                    key={event.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="py-2 px-3 text-sm">
                      {formatDate(event.created_at)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="capitalize">
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(event.severity)}`}
                      >
                        {event.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm font-mono">
                      {event.identifier || 'N/A'}
                    </td>
                    <td className="py-2 px-3 text-sm">
                      {event.details ? (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 dark:text-blue-400">
                            View details
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        'No details'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Rate Limits */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">
          Recent Rate Limit Activity
        </h3>

        {rateLimitStats.length === 0 ? (
          <p className="text-gray-500 italic">
            No rate limit activity to display
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-3">Timestamp</th>
                  <th className="text-left py-2 px-3">Action Type</th>
                  <th className="text-left py-2 px-3">Identifier</th>
                  <th className="text-left py-2 px-3">Count</th>
                  <th className="text-left py-2 px-3">Window Start</th>
                </tr>
              </thead>
              <tbody>
                {rateLimitStats.map(limit => (
                  <tr
                    key={limit.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="py-2 px-3 text-sm">
                      {formatDate(limit.created_at)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="capitalize">
                        {limit.action_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm font-mono">
                      {limit.identifier}
                    </td>
                    <td className="py-2 px-3 font-semibold">{limit.count}</td>
                    <td className="py-2 px-3 text-sm">
                      {formatDate(limit.window_start)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Refresh */}
      <div className="flex justify-between items-center">
        <a
          href="/admin/comments"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to Comment Management
        </a>
        <button
          onClick={loadSecurityData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
}

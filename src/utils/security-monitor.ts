// Basic security monitoring for client-side events
// Note: This should be supplemented with server-side monitoring

interface SecurityEvent {
  type: 'failed_auth' | 'rate_limit_hit' | 'invalid_input' | 'xss_attempt';
  timestamp: number;
  details?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
}

const MAX_EVENTS = 100; // Keep only recent events

/**
 * Log a security event
 * @param type - Type of security event
 * @param details - Additional details about the event
 */
export function logSecurityEvent(
  type: SecurityEvent['type'],
  details?: Record<string, unknown>
): void {
  try {
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      details,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Get existing events from localStorage
    const existingEvents = getSecurityEvents();

    // Add new event and keep only recent ones
    const updatedEvents = [event, ...existingEvents].slice(0, MAX_EVENTS);

    // Store in localStorage
    localStorage.setItem('security_events', JSON.stringify(updatedEvents));

    // Log to console in development
    if (
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    ) {
      // eslint-disable-next-line no-console
      console.warn('Security Event:', event);
    }

    // In production, you might want to send to monitoring service
    if (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      shouldReport(type)
    ) {
      reportToMonitoring(event);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to log security event:', error);
  }
}

/**
 * Get recent security events
 * @returns Array of recent security events
 */
export function getSecurityEvents(): SecurityEvent[] {
  try {
    const stored = localStorage.getItem('security_events');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to retrieve security events:', error);
    return [];
  }
}

/**
 * Check if we should report this event type to external monitoring
 * @param type - Event type
 * @returns boolean
 */
function shouldReport(type: SecurityEvent['type']): boolean {
  // Report critical events immediately
  const criticalEvents = ['xss_attempt', 'failed_auth'];
  return criticalEvents.includes(type);
}

/**
 * Report security event to external monitoring service
 * @param event - Security event to report
 */
async function reportToMonitoring(event: SecurityEvent): Promise<void> {
  try {
    // This could be replaced with your preferred monitoring service
    // e.g., Sentry, LogRocket, custom endpoint, etc.

    // For now, we'll use a simple fetch to a hypothetical endpoint
    // You should replace this with your actual monitoring solution
    const response = await fetch('/api/security-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Failed to report: ${response.status}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to report security event:', error);
  }
}

/**
 * Get security event statistics
 * @param timeWindow - Time window in milliseconds (default: 24 hours)
 * @returns Statistics about recent security events
 */
export function getSecurityStats(timeWindow = 24 * 60 * 60 * 1000): {
  total: number;
  byType: Record<string, number>;
  recentActivity: boolean;
} {
  const events = getSecurityEvents();
  const cutoff = Date.now() - timeWindow;
  const recentEvents = events.filter(event => event.timestamp > cutoff);

  const byType = recentEvents.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    total: recentEvents.length,
    byType,
    recentActivity: recentEvents.length > 0,
  };
}

/**
 * Clear old security events (call this periodically)
 * @param olderThan - Clear events older than this many milliseconds
 */
export function clearOldEvents(olderThan = 7 * 24 * 60 * 60 * 1000): void {
  try {
    const events = getSecurityEvents();
    const cutoff = Date.now() - olderThan;
    const recentEvents = events.filter(event => event.timestamp > cutoff);

    localStorage.setItem('security_events', JSON.stringify(recentEvents));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear old events:', error);
  }
}

// Rate limit configuration and debugging utilities

export const RATE_LIMIT_CONFIG = {
  COMMENT_INTERVAL: 30 * 1000, // 30 seconds between comments
  MAX_CONTENT_LENGTH: 2000, // Maximum comment length
  MAX_NAME_LENGTH: 500, // Maximum name length
};

/**
 * Get current rate limit status for debugging
 */
export function getRateLimitStatus(): {
  lastSubmission: number | null;
  timeRemaining: number;
  canSubmit: boolean;
  nextAllowedTime: string;
} {
  const lastSubmission = localStorage.getItem('lastCommentSubmission');
  const now = Date.now();

  if (!lastSubmission) {
    return {
      lastSubmission: null,
      timeRemaining: 0,
      canSubmit: true,
      nextAllowedTime: 'Now',
    };
  }

  const lastTime = parseInt(lastSubmission);
  const timeDiff = now - lastTime;
  const timeRemaining = Math.max(
    0,
    RATE_LIMIT_CONFIG.COMMENT_INTERVAL - timeDiff
  );

  return {
    lastSubmission: lastTime,
    timeRemaining,
    canSubmit: timeRemaining === 0,
    nextAllowedTime:
      timeRemaining > 0
        ? new Date(now + timeRemaining).toLocaleTimeString()
        : 'Now',
  };
}

/**
 * Debug function to display rate limit info in console
 */
export function debugRateLimits(): void {
  const status = getRateLimitStatus();
  // eslint-disable-next-line no-console
  console.group('🚦 Rate Limit Status');
  // eslint-disable-next-line no-console
  console.log('Can Submit:', status.canSubmit);
  // eslint-disable-next-line no-console
  console.log(
    'Time Remaining:',
    Math.ceil(status.timeRemaining / 1000),
    'seconds'
  );
  // eslint-disable-next-line no-console
  console.log('Next Allowed:', status.nextAllowedTime);
  // eslint-disable-next-line no-console
  console.log(
    'Last Submission:',
    status.lastSubmission
      ? new Date(status.lastSubmission).toLocaleString()
      : 'Never'
  );
  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * Reset rate limits (for testing purposes only)
 */
export function resetRateLimits(): void {
  localStorage.removeItem('lastCommentSubmission');
  // eslint-disable-next-line no-console
  console.log('🔄 Rate limits reset');
}

// Make debugging functions available globally in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  (window as unknown as Record<string, unknown>).debugRateLimits =
    debugRateLimits;
  (window as unknown as Record<string, unknown>).resetRateLimits =
    resetRateLimits;
  (window as unknown as Record<string, unknown>).getRateLimitStatus =
    getRateLimitStatus;
}

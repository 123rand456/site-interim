import { useEffect } from 'react';
import {
  trackPageView,
  startReadingSession,
  setupAutoTracking,
} from '../utils/analytics';

interface AnalyticsTrackerProps {
  pagePath?: string;
  pageTitle?: string;
  essaySlug?: string;
  enableReadingTracking?: boolean;
}

export default function AnalyticsTracker({
  pagePath,
  pageTitle,
  essaySlug,
  enableReadingTracking = false,
}: AnalyticsTrackerProps) {
  console.log('🚀 AnalyticsTracker: Component mounted with props:', {
    pagePath,
    pageTitle,
    essaySlug,
    enableReadingTracking,
  });

  useEffect(() => {
    const currentPath = pagePath || window.location.pathname;
    const currentTitle = pageTitle || document.title;

    console.log('📊 AnalyticsTracker: Starting tracking for', currentPath);

    // Track page view
    trackPageView(currentPath, currentTitle).catch(error => {
      console.error('❌ AnalyticsTracker: Page view tracking failed:', error);
    });

    // Start reading session for essays
    if (enableReadingTracking && essaySlug) {
      startReadingSession(currentPath, essaySlug).catch(error => {
        console.error('❌ AnalyticsTracker: Reading session failed:', error);
      });
    }

    // Set up auto-tracking for SPA navigation
    setupAutoTracking();
  }, [pagePath, pageTitle, essaySlug, enableReadingTracking]);

  // This component doesn't render anything
  return null;
}

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
  // Component mounted with analytics tracking

  useEffect(() => {
    const currentPath = pagePath || window.location.pathname;
    const currentTitle = pageTitle || document.title;

    // Track page view
    trackPageView(currentPath, currentTitle).catch(() => {
      console.error('Page view tracking failed');
    });

    // Start reading session for essays
    if (enableReadingTracking && essaySlug) {
      startReadingSession(currentPath, essaySlug).catch(() => {
        console.error('Reading session failed');
      });
    }

    // Set up auto-tracking for SPA navigation
    setupAutoTracking();
  }, [pagePath, pageTitle, essaySlug, enableReadingTracking]);

  // This component doesn't render anything
  return null;
}

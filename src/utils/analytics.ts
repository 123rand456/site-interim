// Analytics utility for tracking page views and engagement
import { supabase } from './supabase';

// TypeScript declarations for Vercel Analytics
declare global {
  interface Window {
    va?: (...args: any[]) => void;
  }
}

// Generate a session ID for analytics
export function getSessionId(): string {
  const existingId = sessionStorage.getItem('analytics_session_id');
  if (existingId) return existingId;

  const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('analytics_session_id', newId);
  return newId;
}

// Track page view with Supabase only
export async function trackPageView(
  pagePath: string,
  pageTitle?: string,
  _additionalData?: Record<string, any>
): Promise<void> {
  try {
    console.log('📈 trackPageView: Starting for', pagePath);

    // Debug Supabase client
    console.log('🔧 Supabase client check:', {
      hasClient: !!supabase,
      hasAuth: !!supabase.auth,
      hasRpc: !!supabase.rpc,
      url:
        (import.meta as any).env.PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
      hasKey: !!(import.meta as any).env.PUBLIC_SUPABASE_ANON_KEY,
    });

    // Test basic Supabase connection with timeout
    try {
      console.log('🔌 Testing basic Supabase connection...');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Basic query timeout')), 5000)
      );

      const queryPromise = supabase.from('page_views').select('count').limit(1);

      const { error: testError } = (await Promise.race([
        queryPromise,
        timeoutPromise,
      ])) as any;

      if (testError) {
        console.error('❌ Basic Supabase query failed:', testError);
      } else {
        console.log('✅ Basic Supabase query successful');
      }
    } catch (error) {
      console.error('❌ Basic Supabase connection failed:', error);
    }

    console.log('🔄 Moving to RPC call...');

    // Supabase tracking with privacy-respecting data
    const sessionId = getSessionId();
    console.log(
      '📝 About to call track_page_view RPC with session:',
      sessionId
    );

    try {
      console.log('🌐 Starting RPC call to Supabase...');
      console.log('⏱️ Setting up timeout...');

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), 10000)
      );

      const rpcPromise = supabase.rpc('track_page_view', {
        p_page_path: pagePath,
        p_page_title: pageTitle,
        p_referrer: document.referrer || null,
        p_user_agent: navigator.userAgent,
        p_session_id: sessionId,
        p_viewport_width: window.innerWidth,
        p_viewport_height: window.innerHeight,
        p_screen_width: screen.width,
        p_screen_height: screen.height,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        p_language: navigator.language,
      });

      console.log('📡 RPC call initiated, waiting for response...');

      // Try a simple RPC call first to test connectivity
      try {
        console.log('🧪 Testing simple RPC call...');
        const { error: simpleError } = await supabase.rpc('get_daily_views', {
          p_start_date: '2025-01-01',
          p_end_date: '2025-01-31',
        });

        if (simpleError) {
          console.error('❌ Simple RPC failed:', simpleError);
        } else {
          console.log('✅ Simple RPC successful');
        }
      } catch (error) {
        console.error('❌ Simple RPC exception:', error);
      }

      const { data, error } = (await Promise.race([
        rpcPromise,
        timeoutPromise,
      ])) as any;

      if (error) {
        console.error('❌ track_page_view RPC failed:', error);
        return;
      }

      console.log(
        '✅ trackPageView: Successfully tracked',
        pagePath,
        'with ID:',
        data
      );
    } catch (error) {
      console.error('❌ track_page_view RPC exception:', error);
    }
  } catch (error) {
    // Fail silently to not break user experience
    console.error('❌ trackPageView: Failed to track', pagePath, error);
  }
}

// Track reading session for essays
let currentReadingSession: {
  sessionId: string;
  pagePath: string;
  startTime: number;
  scrollDepth: number;
  engaged: boolean;
} | null = null;

export async function startReadingSession(
  pagePath: string,
  essaySlug?: string
): Promise<void> {
  try {
    const sessionId = getSessionId();

    currentReadingSession = {
      sessionId,
      pagePath,
      startTime: Date.now(),
      scrollDepth: 0,
      engaged: false,
    };

    await supabase.rpc('start_reading_session', {
      p_session_id: sessionId,
      p_page_path: pagePath,
      p_essay_slug: essaySlug,
    });

    // Set up scroll tracking
    setupScrollTracking();

    // Set up engagement tracking
    setupEngagementTracking();
  } catch (error) {
    console.debug('Reading session tracking failed:', error);
  }
}

export async function endReadingSession(): Promise<void> {
  if (!currentReadingSession) return;

  try {
    const readingTimeSeconds = Math.floor(
      (Date.now() - currentReadingSession.startTime) / 1000
    );
    const scrollDepthPercent = currentReadingSession.scrollDepth;

    // Estimate words read based on scroll depth
    const wordsReadEstimate = Math.floor(
      (document.body.innerText?.length || 0) *
        0.005 *
        (scrollDepthPercent / 100)
    );

    await supabase.rpc('update_reading_session', {
      p_session_id: currentReadingSession.sessionId,
      p_page_path: currentReadingSession.pagePath,
      p_reading_time_seconds: readingTimeSeconds,
      p_scroll_depth_percent: scrollDepthPercent,
      p_words_read_estimate: wordsReadEstimate,
      p_engaged: currentReadingSession.engaged,
      p_completed: scrollDepthPercent > 80, // Consider 80%+ as completed
    });

    currentReadingSession = null;
  } catch (error) {
    console.debug('Reading session end tracking failed:', error);
  }
}

// Track search queries
export async function trackSearchQuery(
  query: string,
  resultsCount: number = 0,
  clickedResult?: string
): Promise<void> {
  try {
    const sessionId = getSessionId();

    await supabase.rpc('track_search_query', {
      p_query: query,
      p_results_count: resultsCount,
      p_clicked_result: clickedResult,
      p_session_id: sessionId,
    });
  } catch (error) {
    console.debug('Search tracking failed:', error);
  }
}

// Private functions for engagement tracking
function setupScrollTracking(): void {
  let maxScrollDepth = 0;

  const updateScrollDepth = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.min(
      100,
      Math.max(0, (scrollTop / docHeight) * 100)
    );

    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;
      if (currentReadingSession) {
        currentReadingSession.scrollDepth = Math.floor(scrollPercent);
      }
    }
  };

  window.addEventListener('scroll', updateScrollDepth, { passive: true });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('scroll', updateScrollDepth);
  });
}

function setupEngagementTracking(): void {
  let lastActivity = Date.now();
  let engaged = false;

  const updateActivity = () => {
    lastActivity = Date.now();
    if (!engaged && currentReadingSession) {
      engaged = true;
      currentReadingSession.engaged = true;
    }
  };

  // Track various engagement signals
  ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(
    event => {
      document.addEventListener(event, updateActivity, { passive: true });
    }
  );

  // Check for inactivity
  const inactivityCheck = setInterval(() => {
    if (Date.now() - lastActivity > 30000) {
      // 30 seconds of inactivity
      engaged = false;
      if (currentReadingSession) {
        currentReadingSession.engaged = false;
      }
    }
  }, 10000);

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(inactivityCheck);
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(
      event => {
        document.removeEventListener(event, updateActivity);
      }
    );
  });
}

// Auto-track page views for SPA navigation
export function setupAutoTracking(): void {
  // Track initial page view
  trackPageView(window.location.pathname, document.title);

  // Track page unloads
  window.addEventListener('beforeunload', endReadingSession);

  // Track browser back/forward navigation
  window.addEventListener('popstate', () => {
    endReadingSession();
    setTimeout(() => {
      trackPageView(window.location.pathname, document.title);
    }, 100);
  });
}

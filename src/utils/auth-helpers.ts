import { supabase } from './supabase';

/**
 * Check if a session is valid (exists and not expired)
 */
export function isSessionValid(session: any): boolean {
  if (!session) return false;

  // Check if session has expiration
  if (!session.expires_at) return false;

  // Check if session is expired (with 30 second buffer)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at;
  const buffer = 30; // 30 second buffer

  return expiresAt > now + buffer;
}

/**
 * Get current valid session with timeout protection
 * Checks both existence and expiration
 */
export async function getValidSession(timeoutMs: number = 5000) {
  try {
    // Wrap getSession with timeout to prevent hanging
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session check timeout')), timeoutMs)
    );

    const {
      data: { session },
      error,
    } = (await Promise.race([sessionPromise, timeoutPromise])) as Awaited<
      ReturnType<typeof supabase.auth.getSession>
    >;

    if (error) {
      console.error('Session fetch error:', error);
      return null;
    }

    if (!session) {
      return null;
    }

    // Check if expired
    if (!isSessionValid(session)) {
      console.log('Session expired, attempting refresh...');

      // Try to refresh (also with timeout)
      const refreshPromise = supabase.auth.refreshSession();
      const refreshTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Refresh timeout')), timeoutMs)
      );

      try {
        const { data: refreshData, error: refreshError } = (await Promise.race([
          refreshPromise,
          refreshTimeoutPromise,
        ])) as Awaited<ReturnType<typeof supabase.auth.refreshSession>>;

        if (refreshError || !refreshData.session) {
          console.log('Session refresh failed');
          return null;
        }

        console.log('Session refreshed successfully');
        return refreshData.session;
      } catch (refreshErr) {
        console.warn('Session refresh timed out or failed:', refreshErr);
        return null;
      }
    }

    return session;
  } catch (error) {
    if (error instanceof Error && error.message === 'Session check timeout') {
      console.warn('⏱️ Session check timed out, clearing stale state...');
      // Clear potentially stale auth state
      localStorage.clear();
      sessionStorage.clear();
      // Optionally reload after a short delay
      setTimeout(() => window.location.reload(), 1000);
      return null;
    }
    console.error('getValidSession error:', error);
    return null;
  }
}

/**
 * Complete sign out - clears all auth state
 */
export async function completeSignOut() {
  try {
    console.log('🚪 Starting complete sign out...');

    // 1. Sign out from Supabase (this should invalidate the session server-side)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('Supabase signOut error:', error);
      // Continue with cleanup even if this fails
    }

    // 2. Clear all localStorage items
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 3. Clear sessionStorage
    sessionStorage.clear();

    // 4. Clear cookies
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      document.cookie =
        name +
        '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' +
        window.location.hostname;
    });

    console.log('✅ Sign out complete');
    return true;
  } catch (error) {
    console.error('❌ Sign out error:', error);
    // Even on error, try to clear local state
    localStorage.clear();
    sessionStorage.clear();
    return false;
  }
}

/**
 * Format time remaining until session expires
 */
export function getSessionTimeRemaining(session: any): string {
  if (!session || !session.expires_at) return 'Unknown';

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at;
  const remaining = expiresAt - now;

  if (remaining < 0) return 'Expired';
  if (remaining < 60) return `${remaining}s`;
  if (remaining < 3600) return `${Math.floor(remaining / 60)}m`;
  return `${Math.floor(remaining / 3600)}h`;
}

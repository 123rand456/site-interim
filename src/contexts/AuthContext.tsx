import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getCurrentAdmin } from '../utils/supabase';
import { base } from '../utils/constants';
import { logSecurityEvent } from '../utils/security-monitor';

type AdminUser = {
  id: string;
  email: string | undefined;
} | null;

type AuthContextType = {
  admin: AdminUser;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        getCurrentAdmin().then(setAdmin);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const currentAdmin = await getCurrentAdmin();
        setAdmin(currentAdmin);
      } else {
        setAdmin(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Auto-refresh session to prevent magic link expiration
  useEffect(() => {
    const refreshInterval = setInterval(
      async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session && session.expires_at) {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = session.expires_at;
            const timeUntilExpiry = expiresAt - now;

            // If session expires in less than 10 minutes, try to refresh
            if (timeUntilExpiry < 600) {
              console.log('Session expiring soon, attempting refresh...');
              const { error } = await supabase.auth.refreshSession();

              if (error) {
                console.warn('Session refresh failed:', error);
              } else {
                console.log('Session refreshed successfully');
              }
            }
          }
        } catch (error) {
          console.warn('Session refresh check failed:', error);
        }
      },
      5 * 60 * 1000
    ); // Check every 5 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  const signIn = async (email: string) => {
    const redirectUrl = `${window.location.origin}${base}auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: false, // Prevent creating new users, admin user (only 1 for now) has been added directly into
      },
    });

    if (error) {
      // Log security event server-side using new Supabase function
      try {
        await supabase.rpc('log_security_event', {
          p_event_type: 'failed_auth',
          p_identifier: email,
          p_details: {
            action: 'magic_link_request_failed',
            email: email,
            error_message: error.message,
            timestamp: new Date().toISOString(),
          },
          p_severity: 'warning',
        });
      } catch (logError) {
        // Fallback to client-side logging if server-side fails
        logSecurityEvent('failed_auth', {
          action: 'magic_link_request_failed',
          email: email,
          error_message: error.message,
          log_error: logError.message,
        });
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Check session validity first
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // If no valid session, just clear local state
        console.log('No valid session for logout, clearing local state...');
        setAdmin(null);
        return;
      }

      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        console.log('Session expired, clearing local state...');
        setAdmin(null);
        return;
      }

      // Valid session - attempt normal logout
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase signOut failed:', error);
        // Still clear local state even if server signOut fails
      }

      setAdmin(null);
    } catch (error) {
      console.error('SignOut error:', error);
      // Always clear local state, even on error
      setAdmin(null);
    }
  };

  const value = {
    admin,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

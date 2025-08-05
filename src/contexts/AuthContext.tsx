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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAdmin(null);
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

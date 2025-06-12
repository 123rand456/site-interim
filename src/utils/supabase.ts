import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

// Only run these in browser environment
if (typeof window !== 'undefined') {
  supabase.auth.getSession().catch(() => {
    // Silently fail - session errors are handled by the auth system
  });

  supabase.auth.onAuthStateChange(() => {
    // Intentionally empty - just setting up the listener
  });
}

export type UserRole = 'admin' | 'user';

export type Comment = {
  id: string;
  essay_slug: string;
  author_name: string;
  author_email?: string;
  content: string;
  created_at: string;
  updated_at: string;
  parent_id?: string; // nested comments
  is_approved: boolean;
  session_id: string;
};

// Get or create a session ID for anonymous users
export function getSessionId(): string {
  let sessionId = localStorage.getItem('comment_session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('comment_session_id', sessionId);
  }
  return sessionId;
}

// Set session ID in Supabase config for RLS policies
export async function setSessionConfig() {
  const sessionId = getSessionId();
  const { data, error } = await supabase.rpc('set_config', {
    name: 'app.session_id',
    value: sessionId,
  });

  if (error) {
    throw error;
  }
  return data;
}

export async function getCurrentAdmin() {
  // if this fails, it's unexpected and should bubble up
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // expected case: not logged in
  if (!session) return null;

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  // Database error is unexpected - should bubble up
  if (error) throw error;

  // expected case: not being an admin
  if (!adminUser) return null;

  // Success case
  return {
    id: session.user.id,
    email: session.user.email,
  };
}

// client-side protection, server-side protection in database schema
export function canEditComment(comment: Comment): boolean {
  const sessionId = getSessionId();
  if (comment.session_id !== sessionId) return false;

  const diffMinutes =
    (new Date().getTime() - new Date(comment.created_at).getTime()) /
    (1000 * 60);
  return diffMinutes <= 5;
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
};

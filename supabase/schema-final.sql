-- =========================================
-- FINAL CONSOLIDATED SUPABASE SCHEMA
-- Phase 2 Security Implementation
-- Date: 2025-08-05
-- =========================================

-- This script consolidates all schema changes and security enhancements
-- Run this in your Supabase SQL Editor to apply all changes

SET search_path = public;

-- =========================================
-- 1. CORE TABLES AND SCHEMA
-- =========================================

-- Comments table (already exists, ensuring structure)
-- Note: This table should already exist from previous setup

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 2. SECURITY TABLES (Phase 2)
-- =========================================

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or user ID
  action_type TEXT NOT NULL, -- 'comment_submit', 'auth_attempt', etc.
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'failed_auth', 'rate_limit_hit', 'comment_submission', etc.
  identifier TEXT, -- IP, email, user ID, etc.
  details JSONB, -- Flexible data storage
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 3. INDEXES FOR PERFORMANCE
-- =========================================

-- Rate limits indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action 
ON rate_limits(identifier, action_type);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start 
ON rate_limits(window_start);

-- Security events indexes  
CREATE INDEX IF NOT EXISTS idx_security_events_type 
ON security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_security_events_created_at 
ON security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_identifier 
ON security_events(identifier);

-- =========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to rebuild them optimally
DROP POLICY IF EXISTS "users_can_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "allow_profile_creation" ON user_profiles;
DROP POLICY IF EXISTS "admins_can_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

DROP POLICY IF EXISTS "check_own_admin_status" ON admin_users;
DROP POLICY IF EXISTS "allow_read_own_row" ON admin_users;
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;

DROP POLICY IF EXISTS "admin_only_rate_limits" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_admin_policy" ON rate_limits;

DROP POLICY IF EXISTS "admin_only_security_events" ON security_events;
DROP POLICY IF EXISTS "security_events_admin_policy" ON security_events;

-- User profiles policies
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT USING (
    user_id = (SELECT auth.uid()) OR 
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = (SELECT auth.uid()))
  );

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE USING (
    user_id = (SELECT auth.uid()) OR 
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = (SELECT auth.uid()))
  );

CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = (SELECT auth.uid()))
  );

-- Admin users policies
CREATE POLICY "admin_users_policy" ON admin_users
  FOR ALL USING (id = (SELECT auth.uid()));

-- Rate limits policies (admin only)
CREATE POLICY "rate_limits_admin_policy" ON rate_limits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = (SELECT auth.uid()))
  );

-- Security events policies (admin only)
CREATE POLICY "security_events_admin_policy" ON security_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = (SELECT auth.uid()))
  );

-- =========================================
-- 5. SECURITY FUNCTIONS
-- =========================================

-- Rate limiting check function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action_type TEXT,
  p_max_count INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  SET search_path = public;
  
  window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Get current count within the time window
  SELECT COALESCE(SUM(count), 0) INTO current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_start > window_start;
  
  -- Return false if limit exceeded
  IF current_count >= p_max_count THEN
    RETURN FALSE;
  END IF;
  
  -- Update or insert rate limit record
  INSERT INTO rate_limits (identifier, action_type, count, window_start)
  VALUES (p_identifier, p_action_type, 1, NOW())
  ON CONFLICT (identifier, action_type) 
  DO UPDATE SET
    count = rate_limits.count + 1,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Security event logging function
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_identifier TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'info'
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  SET search_path = public;
  
  INSERT INTO security_events (event_type, identifier, details, severity)
  VALUES (p_event_type, p_identifier, p_details, p_severity)
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Secure comment insertion function
CREATE OR REPLACE FUNCTION insert_comment_secure(
  p_essay_slug TEXT,
  p_author_name TEXT,
  p_author_email TEXT DEFAULT NULL,
  p_content TEXT,
  p_parent_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
) RETURNS TABLE(
  id UUID,
  essay_slug TEXT,
  author_name TEXT,
  author_email TEXT,
  content TEXT,
  parent_id UUID,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  is_approved BOOLEAN
) AS $$
DECLARE
  client_ip TEXT;
  new_comment_id UUID;
  rate_check BOOLEAN;
BEGIN
  SET search_path = public;
  
  -- Extract IP from request headers if not provided
  client_ip := COALESCE(
    p_ip_address,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    current_setting('request.headers', true)::json->>'cf-connecting-ip',
    'unknown'
  );
  
  -- Extract first IP if comma-separated
  IF position(',' in client_ip) > 0 THEN
    client_ip := split_part(client_ip, ',', 1);
  END IF;
  
  client_ip := trim(client_ip);
  
  -- Check rate limit (5 comments per 30 minutes)
  rate_check := check_rate_limit(client_ip, 'comment_submit', 5, 30);
  
  IF NOT rate_check THEN
    -- Log rate limit violation
    PERFORM log_security_event(
      'rate_limit_hit',
      client_ip,
      jsonb_build_object(
        'action', 'comment_submit',
        'essay_slug', p_essay_slug,
        'author_name', p_author_name,
        'limit_type', '5_per_30min'
      ),
      'warning'
    );
    
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before submitting another comment.'
      USING ERRCODE = 'P0001';
  END IF;
  
  -- Insert the comment
  INSERT INTO comments (
    essay_slug,
    author_name,
    author_email,
    content,
    parent_id,
    session_id,
    is_approved
  ) VALUES (
    p_essay_slug,
    p_author_name,
    p_author_email,
    p_content,
    p_parent_id,
    p_session_id,
    false -- Comments require approval
  ) RETURNING comments.id INTO new_comment_id;
  
  -- Log successful comment submission
  PERFORM log_security_event(
    'comment_submission',
    client_ip,
    jsonb_build_object(
      'comment_id', new_comment_id,
      'essay_slug', p_essay_slug,
      'author_name', p_author_name,
      'has_email', (p_author_email IS NOT NULL),
      'has_parent', (p_parent_id IS NOT NULL)
    ),
    'info'
  );
  
  -- Return the new comment
  RETURN QUERY
  SELECT 
    comments.id,
    comments.essay_slug,
    comments.author_name,
    comments.author_email,
    comments.content,
    comments.parent_id,
    comments.session_id,
    comments.created_at,
    comments.is_approved
  FROM comments
  WHERE comments.id = new_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================
-- 6. GRANTS AND PERMISSIONS
-- =========================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant access to tables for authenticated users
GRANT SELECT ON user_profiles TO authenticated;
GRANT INSERT, UPDATE ON user_profiles TO authenticated;

GRANT SELECT ON admin_users TO authenticated;

-- Grant execution permissions for functions
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated, anon;
GRANT EXECUTE ON FUNCTION insert_comment_secure TO authenticated, anon;

-- =========================================
-- 7. DATA CLEANUP (Optional)
-- =========================================

-- Clean up old rate limit records (older than 1 day)
-- DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '1 day';

-- Clean up old security events (older than 30 days)  
-- DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '30 days';

-- =========================================
-- COMPLETION NOTICE
-- =========================================

DO $$ 
BEGIN 
  RAISE NOTICE 'Phase 2 Security Schema Applied Successfully!';
  RAISE NOTICE 'Tables created: rate_limits, security_events, user_profiles';
  RAISE NOTICE 'Functions created: check_rate_limit, log_security_event, insert_comment_secure';
  RAISE NOTICE 'RLS policies applied for admin-only access to security tables';
  RAISE NOTICE 'Ready for production deployment!';
END $$; 
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

-- ====================
-- ANALYTICS TABLES
-- ====================

-- Page views and basic analytics
CREATE TABLE IF NOT EXISTS public.page_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path TEXT NOT NULL,
    page_title TEXT,
    referrer TEXT,
    user_agent TEXT,
    session_id TEXT NOT NULL,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- Additional context
    viewport_width INTEGER,
    viewport_height INTEGER,
    screen_width INTEGER,
    screen_height INTEGER,
    timezone TEXT,
    language TEXT
);

-- Reading engagement metrics
CREATE TABLE IF NOT EXISTS public.reading_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_path TEXT NOT NULL,
    essay_slug TEXT, -- For essays specifically
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    reading_time_seconds INTEGER DEFAULT 0,
    scroll_depth_percent INTEGER DEFAULT 0,
    words_read_estimate INTEGER DEFAULT 0,
    engaged BOOLEAN DEFAULT false, -- User actively engaged (not just idle)
    completed BOOLEAN DEFAULT false -- Read to the end
);

-- Search analytics
CREATE TABLE IF NOT EXISTS public.search_queries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    clicked_result TEXT, -- Which result was clicked
    session_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Content performance analytics
CREATE TABLE IF NOT EXISTS public.content_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_path TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL, -- 'essay', 'page', etc.
    total_views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    average_reading_time_seconds INTEGER DEFAULT 0,
    average_scroll_depth_percent INTEGER DEFAULT 0,
    bounce_rate_percent INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
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

-- ====================
-- ANALYTICS INDEXES
-- ====================

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON public.page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views(session_id);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_session_id ON public.reading_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_essay_slug ON public.reading_sessions(essay_slug);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_started_at ON public.reading_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON public.search_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_search_queries_query ON public.search_queries(query);

CREATE INDEX IF NOT EXISTS idx_content_analytics_content_path ON public.content_analytics(content_path);

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

-- ====================
-- ANALYTICS RLS POLICIES
-- ====================

-- Page views: Insert only, admin read
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous page view tracking" ON public.page_views
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow admins to read page views" ON public.page_views
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.id = (select auth.uid())
        )
    );

-- Reading sessions: Insert and update for tracking, admin read
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous reading session tracking" ON public.reading_sessions
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow anonymous reading session updates" ON public.reading_sessions
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow admins to read reading sessions" ON public.reading_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.id = (select auth.uid())
        )
    );

-- Search queries: Insert only, admin read
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous search tracking" ON public.search_queries
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow admins to read search queries" ON public.search_queries
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.id = (select auth.uid())
        )
    );

-- Content analytics: Admin only
ALTER TABLE public.content_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins full access to content analytics" ON public.content_analytics
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.id = (select auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_users.id = (select auth.uid())
        )
    );

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

-- ====================
-- ANALYTICS FUNCTIONS
-- ====================

-- Function to track page view
CREATE OR REPLACE FUNCTION public.track_page_view(
    p_page_path TEXT,
    p_page_title TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_viewport_width INTEGER DEFAULT NULL,
    p_viewport_height INTEGER DEFAULT NULL,
    p_screen_width INTEGER DEFAULT NULL,
    p_screen_height INTEGER DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL,
    p_language TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    view_id UUID;
BEGIN
    INSERT INTO public.page_views (
        page_path, page_title, referrer, user_agent, session_id, ip_address,
        viewport_width, viewport_height, screen_width, screen_height, timezone, language
    ) VALUES (
        p_page_path, p_page_title, p_referrer, p_user_agent, p_session_id, p_ip_address,
        p_viewport_width, p_viewport_height, p_screen_width, p_screen_height, p_timezone, p_language
    ) RETURNING id INTO view_id;
    
    -- Update content analytics
    INSERT INTO public.content_analytics (content_path, content_type, total_views, unique_views)
    VALUES (p_page_path, 
            CASE WHEN p_page_path LIKE '%/essays/%' THEN 'essay' ELSE 'page' END,
            1, 1)
    ON CONFLICT (content_path) 
    DO UPDATE SET 
        total_views = content_analytics.total_views + 1,
        last_updated = NOW();
    
    RETURN view_id;
END;
$$;

-- Function to start reading session
CREATE OR REPLACE FUNCTION public.start_reading_session(
    p_session_id TEXT,
    p_page_path TEXT,
    p_essay_slug TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_id UUID;
BEGIN
    INSERT INTO public.reading_sessions (session_id, page_path, essay_slug)
    VALUES (p_session_id, p_page_path, p_essay_slug)
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$;

-- Function to update reading session
CREATE OR REPLACE FUNCTION public.update_reading_session(
    p_session_id TEXT,
    p_page_path TEXT,
    p_reading_time_seconds INTEGER DEFAULT NULL,
    p_scroll_depth_percent INTEGER DEFAULT NULL,
    p_words_read_estimate INTEGER DEFAULT NULL,
    p_engaged BOOLEAN DEFAULT NULL,
    p_completed BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.reading_sessions
    SET 
        ended_at = NOW(),
        reading_time_seconds = COALESCE(p_reading_time_seconds, reading_time_seconds),
        scroll_depth_percent = COALESCE(p_scroll_depth_percent, scroll_depth_percent),
        words_read_estimate = COALESCE(p_words_read_estimate, words_read_estimate),
        engaged = COALESCE(p_engaged, engaged),
        completed = COALESCE(p_completed, completed)
    WHERE session_id = p_session_id AND page_path = p_page_path;
    
    -- Update content analytics with engagement metrics
    UPDATE public.content_analytics
    SET 
        average_reading_time_seconds = (
            SELECT AVG(reading_time_seconds)::INTEGER 
            FROM public.reading_sessions 
            WHERE page_path = p_page_path AND reading_time_seconds > 0
        ),
        average_scroll_depth_percent = (
            SELECT AVG(scroll_depth_percent)::INTEGER 
            FROM public.reading_sessions 
            WHERE page_path = p_page_path AND scroll_depth_percent > 0
        ),
        last_updated = NOW()
    WHERE content_path = p_page_path;
END;
$$;

-- Function to track search query
CREATE OR REPLACE FUNCTION public.track_search_query(
    p_query TEXT,
    p_results_count INTEGER DEFAULT 0,
    p_clicked_result TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    query_id UUID;
BEGIN
    INSERT INTO public.search_queries (query, results_count, clicked_result, session_id)
    VALUES (p_query, p_results_count, p_clicked_result, p_session_id)
    RETURNING id INTO query_id;
    
    RETURN query_id;
END;
$$;

-- Function to get daily views for analytics dashboard
CREATE OR REPLACE FUNCTION public.get_daily_views(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE(date DATE, views BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(pv.created_at) as date,
        COUNT(*) as views
    FROM public.page_views pv
    WHERE DATE(pv.created_at) BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(pv.created_at)
    ORDER BY DATE(pv.created_at);
END;
$$;

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

-- Grant execution permissions for analytics functions
GRANT EXECUTE ON FUNCTION public.track_page_view TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.start_reading_session TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_reading_session TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.track_search_query TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_views TO authenticated;

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
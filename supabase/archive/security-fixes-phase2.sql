-- Phase 2 Security Fixes for Supabase Issues
-- Date: 2025-08-03
-- Fixes: RLS, Function Security, Performance Issues

-- =============================================================================
-- 1. FIX CRITICAL: Enable RLS on user_profiles table
-- =============================================================================

-- Enable RLS on user_profiles (this was missing!)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policy for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (id = auth.uid());

-- Allow profile creation for authenticated users
CREATE POLICY "Allow profile creation" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "Admins can manage profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- =============================================================================
-- 2. FIX SECURITY: Function Search Path Issues
-- =============================================================================

-- Fix the insert_comment function with proper search path
CREATE OR REPLACE FUNCTION insert_comment(
  p_essay_slug TEXT,
  p_author_name TEXT,
  p_author_email TEXT,
  p_content TEXT,
  p_parent_id UUID,
  p_session_id TEXT
) RETURNS comments AS $$
DECLARE
  v_comment comments;
BEGIN
  -- Set the session ID for this transaction
  PERFORM set_config('app.session_id', p_session_id, true);
  
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
    false
  ) RETURNING * INTO v_comment;
  
  RETURN v_comment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix the is_admin function with proper search path
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix set_config function with proper search path
CREATE OR REPLACE FUNCTION set_config(
  name text,
  value text
) RETURNS void AS $$
BEGIN
  PERFORM set_config(name, value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_updated_at_column function with proper search path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 3. FIX PERFORMANCE: Optimize RLS Policies
-- =============================================================================

-- Drop existing overlapping policies on comments
DROP POLICY IF EXISTS "select_approved_comments" ON comments;
DROP POLICY IF EXISTS "admin_select_all_comments" ON comments;

-- Create single optimized SELECT policy for comments
CREATE POLICY "optimized_select_comments" ON comments
  FOR SELECT USING (
    is_approved = true 
    OR 
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- =============================================================================
-- 4. ADD SECURITY: Rate Limiting Infrastructure
-- =============================================================================

-- Create rate_limits table for server-side rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP address, user ID, or session ID
  action_type TEXT NOT NULL, -- 'comment_submit', 'login_attempt', etc.
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for rate limiting performance
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_rate_limits_action_type ON rate_limits(action_type);
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);

-- Enable RLS on rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow system/admin access to rate_limits
CREATE POLICY "admin_only_rate_limits" ON rate_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- =============================================================================
-- 5. ADD SECURITY: Security Events Logging
-- =============================================================================

-- Create security_events table for server-side security monitoring
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'failed_auth', 'rate_limit_hit', 'xss_attempt', etc.
  identifier TEXT, -- IP, user ID, session ID
  details JSONB, -- Event-specific details
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for security events
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity);

-- Enable RLS on security_events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only allow admin access to security events
CREATE POLICY "admin_only_security_events" ON security_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- =============================================================================
-- 6. CREATE FUNCTIONS: Rate Limiting & Security
-- =============================================================================

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action_type TEXT,
  p_limit INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate window start
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Clean up old entries
  DELETE FROM rate_limits 
  WHERE window_start < v_window_start;
  
  -- Get current count for this identifier and action
  SELECT COALESCE(SUM(count), 0) 
  INTO v_current_count
  FROM rate_limits
  WHERE identifier = p_identifier 
    AND action_type = p_action_type
    AND window_start >= v_window_start;
  
  -- Check if limit exceeded
  IF v_current_count >= p_limit THEN
    -- Log rate limit hit
    INSERT INTO security_events (event_type, identifier, details, severity)
    VALUES (
      'rate_limit_exceeded',
      p_identifier,
      jsonb_build_object(
        'action_type', p_action_type,
        'current_count', v_current_count,
        'limit', p_limit,
        'window_minutes', p_window_minutes
      ),
      'warning'
    );
    
    RETURN FALSE;
  END IF;
  
  -- Update or insert rate limit entry
  INSERT INTO rate_limits (identifier, action_type, count, window_start)
  VALUES (p_identifier, p_action_type, 1, NOW())
  ON CONFLICT (identifier, action_type) 
  DO UPDATE SET 
    count = rate_limits.count + 1,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_identifier TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'info'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (event_type, identifier, details, severity)
  VALUES (p_event_type, p_identifier, p_details, p_severity)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 7. ENHANCED COMMENT INSERTION WITH SECURITY
-- =============================================================================

-- Enhanced comment insertion with rate limiting and security
CREATE OR REPLACE FUNCTION insert_comment_secure(
  p_essay_slug TEXT,
  p_author_name TEXT,
  p_author_email TEXT,
  p_content TEXT,
  p_parent_id UUID,
  p_session_id TEXT,
  p_ip_address TEXT DEFAULT NULL
) RETURNS comments AS $$
DECLARE
  v_comment comments;
  v_identifier TEXT;
  v_rate_limit_passed BOOLEAN;
BEGIN
  -- Use IP address if available, otherwise session ID
  v_identifier := COALESCE(p_ip_address, p_session_id);
  
  -- Check rate limit (5 comments per 30 minutes)
  SELECT check_rate_limit(v_identifier, 'comment_submit', 5, 30) 
  INTO v_rate_limit_passed;
  
  IF NOT v_rate_limit_passed THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before submitting another comment.';
  END IF;
  
  -- Log comment submission attempt
  PERFORM log_security_event(
    'comment_submission',
    v_identifier,
    jsonb_build_object(
      'essay_slug', p_essay_slug,
      'author_name', p_author_name,
      'content_length', LENGTH(p_content),
      'has_parent', p_parent_id IS NOT NULL
    ),
    'info'
  );
  
  -- Set the session ID for this transaction
  PERFORM set_config('app.session_id', p_session_id, true);
  
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
    false
  ) RETURNING * INTO v_comment;
  
  RETURN v_comment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 8. GRANT PROPER PERMISSIONS
-- =============================================================================

-- Grant necessary permissions to anon and authenticated roles
GRANT SELECT ON rate_limits TO authenticated;
GRANT SELECT ON security_events TO authenticated;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION check_rate_limit TO anon, authenticated;
GRANT EXECUTE ON FUNCTION log_security_event TO anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_comment_secure TO anon, authenticated; 
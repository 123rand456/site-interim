-- Performance & Security Optimizations
-- Date: 2025-08-03
-- Fixes: Auth RLS Performance, Multiple Policies, Function Search Paths

-- =============================================================================
-- 1. FIX SECURITY: Function Search Path Issues
-- =============================================================================

-- Fix the set_config function (this was flagged) - add proper search path
CREATE OR REPLACE FUNCTION set_config(
  name text,
  value text
) RETURNS void AS $$
BEGIN
  PERFORM set_config(name, value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix handle_new_user function (if it exists)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 2. FIX PERFORMANCE: Optimize Auth RLS Policies 
-- =============================================================================

-- Drop all existing policies to rebuild them optimally
DROP POLICY IF EXISTS "check_own_admin_status" ON admin_users;
DROP POLICY IF EXISTS "allow_read_own_row" ON admin_users;
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;

-- Drop ALL existing comment policies (old and new)
DROP POLICY IF EXISTS "select_approved_comments" ON comments;
DROP POLICY IF EXISTS "admin_select_all_comments" ON comments;
DROP POLICY IF EXISTS "optimized_select_comments" ON comments;
DROP POLICY IF EXISTS "insert_comments" ON comments;
DROP POLICY IF EXISTS "comments_insert_policy" ON comments;
DROP POLICY IF EXISTS "admin_update_comments" ON comments;
DROP POLICY IF EXISTS "update_own_recent_comments" ON comments;
DROP POLICY IF EXISTS "comments_update_policy" ON comments;
DROP POLICY IF EXISTS "admin_delete_comments" ON comments;
DROP POLICY IF EXISTS "delete_own_recent_comments" ON comments;
DROP POLICY IF EXISTS "comments_delete_policy" ON comments;
DROP POLICY IF EXISTS "comments_select_policy" ON comments;

DROP POLICY IF EXISTS "users_can_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "allow_profile_creation" ON user_profiles;
DROP POLICY IF EXISTS "admins_can_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

DROP POLICY IF EXISTS "admin_only_rate_limits" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_admin_policy" ON rate_limits;
DROP POLICY IF EXISTS "admin_only_security_events" ON security_events;
DROP POLICY IF EXISTS "security_events_admin_policy" ON security_events;

-- =============================================================================
-- 3. CREATE OPTIMIZED SINGLE POLICIES (No Multiple Permissive Policies)
-- =============================================================================

-- ADMIN_USERS: Single optimized policy
CREATE POLICY "admin_users_policy" ON admin_users
  FOR ALL USING (
    id = (SELECT auth.uid())
  );

-- COMMENTS: Consolidated policies with optimized auth calls
CREATE POLICY "comments_select_policy" ON comments
  FOR SELECT USING (
    is_approved = true 
    OR 
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "comments_insert_policy" ON comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "comments_update_policy" ON comments
  FOR UPDATE USING (
    -- Allow users to update their own recent comments OR admins to update any
    (
      session_id = (SELECT current_setting('app.session_id', true))
      AND (EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) <= 5
    )
    OR 
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "comments_delete_policy" ON comments
  FOR DELETE USING (
    -- Allow users to delete their own recent comments OR admins to delete any
    (
      session_id = (SELECT current_setting('app.session_id', true))
      AND (EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) <= 5
    )
    OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

-- USER_PROFILES: Consolidated policies
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT USING (
    id = (SELECT auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT WITH CHECK (
    id = (SELECT auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

-- RATE_LIMITS: Single admin-only policy
CREATE POLICY "rate_limits_admin_policy" ON rate_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

-- SECURITY_EVENTS: Single admin-only policy  
CREATE POLICY "security_events_admin_policy" ON security_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = (SELECT auth.uid())
    )
  );

-- =============================================================================
-- 4. UPDATE FUNCTIONS: Fix Auth Performance in Functions
-- =============================================================================

-- Update check_rate_limit function with optimized auth calls
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action_type TEXT,
  p_limit INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_auth_uid UUID;
BEGIN
  -- Get auth.uid() once and store it
  v_auth_uid := (SELECT auth.uid());
  
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
        'window_minutes', p_window_minutes,
        'user_id', v_auth_uid
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

-- Update log_security_event function with optimized auth calls
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_identifier TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'info'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_auth_uid UUID;
BEGIN
  -- Get auth.uid() once and store it
  v_auth_uid := (SELECT auth.uid());
  
  -- Add user context to details if authenticated
  IF v_auth_uid IS NOT NULL AND p_details IS NOT NULL THEN
    p_details := p_details || jsonb_build_object('user_id', v_auth_uid);
  ELSIF v_auth_uid IS NOT NULL THEN
    p_details := jsonb_build_object('user_id', v_auth_uid);
  END IF;
  
  INSERT INTO security_events (event_type, identifier, details, severity)
  VALUES (p_event_type, p_identifier, p_details, p_severity)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update insert_comment_secure function with optimized auth calls
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
  v_auth_uid UUID;
BEGIN
  -- Get auth.uid() once and store it
  v_auth_uid := (SELECT auth.uid());
  
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
      'has_parent', p_parent_id IS NOT NULL,
      'user_id', v_auth_uid
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

-- Update is_admin function with optimized auth calls
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_check_user_id UUID;
BEGIN
  -- Use provided user_id or current auth.uid()
  v_check_user_id := COALESCE(user_id, (SELECT auth.uid()));
  
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = v_check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 5. CREATE PERFORMANCE INDEXES
-- =============================================================================

-- Add indexes to improve policy performance
CREATE INDEX IF NOT EXISTS idx_admin_users_id ON admin_users(id);
CREATE INDEX IF NOT EXISTS idx_comments_session_approved ON comments(session_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_comments_created_session ON comments(created_at, session_id);

-- =============================================================================
-- 6. VERIFICATION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Performance and security optimizations applied successfully!';
    RAISE NOTICE 'Key improvements:';
    RAISE NOTICE '- Fixed auth.uid() performance with SELECT wrapper';
    RAISE NOTICE '- Consolidated multiple permissive policies into single policies';
    RAISE NOTICE '- Added search_path to all functions';
    RAISE NOTICE '- Added performance indexes';
END $$; 
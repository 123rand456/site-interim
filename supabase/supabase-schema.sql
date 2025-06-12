-- Drop existing tables and recreate with proper RLS policies
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- Create admin_users table (maybe consider user_roles in future, this suffices for now)
CREATE TABLE admin_users (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create comments table
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  essay_slug TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT false,
  session_id TEXT NOT NULL -- Track anonymous sessions for edit/delete
);

-- Create indexes for better performance
CREATE INDEX idx_comments_essay_slug ON comments(essay_slug);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_approved ON comments(is_approved);
CREATE INDEX idx_comments_session ON comments(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read approved comments" ON comments;
DROP POLICY IF EXISTS "insert_comments" ON comments;
DROP POLICY IF EXISTS "Anyone can delete comments" ON comments;
DROP POLICY IF EXISTS "Anyone can read all comments" ON comments;
DROP POLICY IF EXISTS "admin_read_admin_users" ON admin_users;

-- Comments Policies
-- Allow reading approved comments
CREATE POLICY "select_approved_comments" ON comments
  FOR SELECT USING (is_approved = true);

-- Allow admins to read all comments
CREATE POLICY "admin_select_all_comments" ON comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Allow anyone to insert comments
CREATE POLICY "insert_comments" ON comments
  FOR INSERT WITH CHECK (true);

-- Allow users to update their own comments within 5 minutes
CREATE POLICY "update_own_recent_comments" ON comments
  FOR UPDATE
  USING (
    session_id = current_setting('app.session_id', true) 
    AND (EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) <= 5
  );

-- Allow admins to update any comment
CREATE POLICY "admin_update_comments" ON comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Allow users to delete their own comments within 5 minutes
CREATE POLICY "delete_own_recent_comments" ON comments
  FOR DELETE
  USING (
    session_id = current_setting('app.session_id', true)
    AND (EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) <= 5
  );

-- Allow admins to delete any comment
CREATE POLICY "admin_delete_comments" ON comments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Admin Users Policies
-- Allow any authenticated user to read their own admin status
CREATE POLICY "check_own_admin_status" ON admin_users
  FOR SELECT
  USING (
    -- Only allow users to read rows where the id matches their own auth.uid()
    id = auth.uid()
  );

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_comments_updated_at 
  BEFORE UPDATE ON comments 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert a comment with session tracking
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set session configuration
CREATE OR REPLACE FUNCTION set_config(
  name text,
  value text
) RETURNS void AS $$
BEGIN
  PERFORM set_config(name, value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
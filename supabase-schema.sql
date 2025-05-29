-- Drop existing table and recreate with proper RLS policies
DROP TABLE IF EXISTS comments CASCADE;

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
  is_approved BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX idx_comments_essay_slug ON comments(essay_slug);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_approved ON comments(is_approved);

-- Enable Row Level Security (RLS)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read approved comments" ON comments;
DROP POLICY IF EXISTS "Anyone can insert comments" ON comments;
DROP POLICY IF EXISTS "Anyone can delete comments" ON comments;
DROP POLICY IF EXISTS "Anyone can read all comments" ON comments;

-- Create RLS policies that actually work
-- Allow reading approved comments
CREATE POLICY "select_approved_comments" ON comments
  FOR SELECT USING (is_approved = true);

-- Allow reading all comments (for admin/debugging)
CREATE POLICY "select_all_comments" ON comments
  FOR SELECT USING (true);

-- Allow anyone to insert comments (this is the key fix)
CREATE POLICY "insert_comments" ON comments
  FOR INSERT WITH CHECK (true);

-- Allow updating comments
CREATE POLICY "update_comments" ON comments
  FOR UPDATE USING (true);

-- Allow deleting comments
CREATE POLICY "delete_comments" ON comments
  FOR DELETE USING (true);

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
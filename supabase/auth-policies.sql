-- Enable row level security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Allow Supabase auth to manage users
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated;
GRANT ALL ON auth.users TO postgres;
GRANT SELECT ON auth.users TO anon;
GRANT SELECT ON auth.users TO authenticated;

-- Allow public access to auth.users for email checking
CREATE POLICY "Public users are viewable" ON auth.users
  FOR SELECT USING (true);

-- Allow authenticated users to update their own records
CREATE POLICY "Users can update own record" ON auth.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow insertion of new users
CREATE POLICY "Allow insertion of new users" ON auth.users
  FOR INSERT WITH CHECK (true); 
-- Add avatar_url column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Add full_name column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Update existing records that might have full_name in auth.users but not in public.users
-- This should be done via a function that syncs with auth
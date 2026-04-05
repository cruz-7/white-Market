-- Add seller profile customization fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name_change timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_profile_image_url text;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_seller_display_name ON users(seller_display_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name_change ON users(last_name_change);

-- Add images column to services table
-- This column stores an array of image URLs for the service

ALTER TABLE services ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN services.images IS 'Array of image URLs for the service listing';

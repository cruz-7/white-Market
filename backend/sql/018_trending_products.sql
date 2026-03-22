-- Trending Products System
-- Add tracking columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;

-- Create function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(product_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment click count
CREATE OR REPLACE FUNCTION increment_click_count(product_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment purchase count
CREATE OR REPLACE FUNCTION increment_purchase_count(product_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET purchase_count = COALESCE(purchase_count, 0) + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

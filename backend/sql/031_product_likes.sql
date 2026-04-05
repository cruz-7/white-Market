-- Create product_likes table to track likes on products
CREATE TABLE IF NOT EXISTS product_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON product_likes(user_id);

-- Add like_count column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS product_likes_select ON product_likes;
DROP POLICY IF EXISTS product_likes_insert ON product_likes;
DROP POLICY IF EXISTS product_likes_delete ON product_likes;

CREATE POLICY product_likes_select ON product_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY product_likes_insert ON product_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY product_likes_delete ON product_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Create function to update product like count
CREATE OR REPLACE FUNCTION update_product_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET like_count = (
    SELECT COUNT(*) FROM product_likes WHERE product_id = NEW.product_id
  )
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_like_count_insert ON product_likes;
CREATE TRIGGER update_like_count_insert
AFTER INSERT ON product_likes
FOR EACH ROW
EXECUTE FUNCTION update_product_like_count();

DROP TRIGGER IF EXISTS update_like_count_delete ON product_likes;
CREATE TRIGGER update_like_count_delete
AFTER DELETE ON product_likes
FOR EACH ROW
EXECUTE FUNCTION update_product_like_count();
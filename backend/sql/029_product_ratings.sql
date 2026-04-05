-- Create product_ratings table
CREATE TABLE IF NOT EXISTS product_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  is_verified_purchase BOOLEAN DEFAULT true,
  is_anonymous BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, buyer_id)
);

-- Create indexes (use IF NOT EXISTS to avoid errors on re-run)
CREATE INDEX IF NOT EXISTS idx_product_ratings_product_id ON product_ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_buyer_id ON product_ratings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_rating ON product_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_product_ratings_created_at ON product_ratings(created_at);

-- Add rating columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Create function to update product rating stats
CREATE OR REPLACE FUNCTION update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET 
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM product_ratings
      WHERE product_id = NEW.product_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM product_ratings
      WHERE product_id = NEW.product_id
    )
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update product rating on insert
DROP TRIGGER IF EXISTS update_product_rating_on_insert ON product_ratings;
CREATE TRIGGER update_product_rating_on_insert
AFTER INSERT ON product_ratings
FOR EACH ROW
EXECUTE FUNCTION update_product_rating_stats();

-- Create trigger to update product rating on update
DROP TRIGGER IF EXISTS update_product_rating_on_update ON product_ratings;
CREATE TRIGGER update_product_rating_on_update
AFTER UPDATE ON product_ratings
FOR EACH ROW
EXECUTE FUNCTION update_product_rating_stats();

-- Create trigger to update product rating on delete
DROP TRIGGER IF EXISTS update_product_rating_on_delete ON product_ratings;
CREATE TRIGGER update_product_rating_on_delete
AFTER DELETE ON product_ratings
FOR EACH ROW
EXECUTE FUNCTION update_product_rating_stats();

-- Enable RLS on product_ratings
ALTER TABLE product_ratings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS product_ratings_select ON product_ratings;
DROP POLICY IF EXISTS product_ratings_insert ON product_ratings;

CREATE POLICY product_ratings_select ON product_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY product_ratings_insert ON product_ratings FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

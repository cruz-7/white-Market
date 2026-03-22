-- Create fashion_items table for campus fashion marketplace
CREATE TABLE IF NOT EXISTS fashion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Fashion specific fields
  category VARCHAR(50) NOT NULL,  -- 'shirt', 'pants', 'dress', 'skirt', 'jacket', 'shoes', 'accessory', 'bag', 'headwear'
  gender VARCHAR(20) NOT NULL,  -- 'male', 'female', 'unisex'
  size VARCHAR(20),  -- 'XS', 'S', 'M', 'L', 'XL', 'XXL', or numeric sizes for shoes
  color VARCHAR(50),
  brand VARCHAR(100),
  material VARCHAR(100),  -- e.g., 'cotton', 'polyester', 'leather', 'denim'
  pattern VARCHAR(50),  -- 'solid', 'striped', 'plaid', 'printed', 'geometric'
  
  -- Condition
  condition VARCHAR(20) NOT NULL,  -- 'new', 'like_new', 'good', 'fair'
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  price_negotiable BOOLEAN DEFAULT true,
  original_price DECIMAL(10,2),  -- Original retail price for comparison
  
  -- Details
  location VARCHAR(255),  -- Campus area
  images JSONB,  -- Array of image URLs
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_sold BOOLEAN DEFAULT false,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE fashion_items ENABLE ROW LEVEL SECURITY;

-- Users can view all active fashion items
CREATE POLICY "Anyone can view active fashion_items" ON fashion_items
  FOR SELECT USING (is_active = true);

-- Users can view their own items
CREATE POLICY "Users can view own fashion_items" ON fashion_items
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own items
CREATE POLICY "Users can insert fashion_items" ON fashion_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own items
CREATE POLICY "Users can update own fashion_items" ON fashion_items
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own items
CREATE POLICY "Users can delete own fashion_items" ON fashion_items
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fashion_user_id ON fashion_items(user_id);
CREATE INDEX IF NOT EXISTS idx_fashion_category ON fashion_items(category);
CREATE INDEX IF NOT EXISTS idx_fashion_gender ON fashion_items(gender);
CREATE INDEX IF NOT EXISTS idx_fashion_size ON fashion_items(size);
CREATE INDEX IF NOT EXISTS idx_fashion_color ON fashion_items(color);
CREATE INDEX IF NOT EXISTS idx_fashion_brand ON fashion_items(brand);
CREATE INDEX IF NOT EXISTS idx_fashion_condition ON fashion_items(condition);
CREATE INDEX IF NOT EXISTS idx_fashion_is_active ON fashion_items(is_active);
CREATE INDEX IF NOT EXISTS idx_fashion_is_sold ON fashion_items(is_sold);

-- Create fashion_reviews table
CREATE TABLE IF NOT EXISTS fashion_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fashion_item_id UUID REFERENCES fashion_items(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS for fashion reviews
ALTER TABLE fashion_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fashion reviews" ON fashion_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert fashion reviews" ON fashion_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Create indexes for reviews
CREATE INDEX IF NOT EXISTS idx_fashion_reviews_item_id ON fashion_reviews(fashion_item_id);
CREATE INDEX IF NOT EXISTS idx_fashion_reviews_reviewer_id ON fashion_reviews(reviewer_id);

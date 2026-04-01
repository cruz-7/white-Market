-- Create seller_ratings table with multi-dimensional rating system
CREATE TABLE IF NOT EXISTS seller_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Multi-dimensional ratings (1-5 stars each)
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  product_quality_rating INTEGER CHECK (product_quality_rating >= 1 AND product_quality_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  delivery_speed_rating INTEGER CHECK (delivery_speed_rating >= 1 AND delivery_speed_rating <= 5),
  packaging_rating INTEGER CHECK (packaging_rating >= 1 AND packaging_rating <= 5),
  value_for_money_rating INTEGER CHECK (value_for_money_rating >= 1 AND value_for_money_rating <= 5),
  
  -- Review content
  review_text TEXT,
  review_title VARCHAR(200),
  
  -- Quick feedback tags (stored as JSON array)
  feedback_tags JSONB DEFAULT '[]'::jsonb,
  
  -- Photo reviews (stored as JSON array of URLs)
  review_photos JSONB DEFAULT '[]'::jsonb,
  
  -- Seller response
  seller_response TEXT,
  seller_responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Rating metadata
  is_verified_purchase BOOLEAN DEFAULT true,
  is_anonymous BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one rating per order per buyer
  UNIQUE(order_id, buyer_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_seller_ratings_seller_id ON seller_ratings(seller_id);
CREATE INDEX idx_seller_ratings_buyer_id ON seller_ratings(buyer_id);
CREATE INDEX idx_seller_ratings_order_id ON seller_ratings(order_id);
CREATE INDEX idx_seller_ratings_overall_rating ON seller_ratings(overall_rating);
CREATE INDEX idx_seller_ratings_created_at ON seller_ratings(created_at);

-- Create seller_rating_stats materialized view for analytics
CREATE MATERIALIZED VIEW seller_rating_stats AS
SELECT 
  seller_id,
  COUNT(*) as total_ratings,
  ROUND(AVG(overall_rating)::numeric, 2) as avg_overall_rating,
  ROUND(AVG(product_quality_rating)::numeric, 2) as avg_product_quality_rating,
  ROUND(AVG(communication_rating)::numeric, 2) as avg_communication_rating,
  ROUND(AVG(delivery_speed_rating)::numeric, 2) as avg_delivery_speed_rating,
  ROUND(AVG(packaging_rating)::numeric, 2) as avg_packaging_rating,
  ROUND(AVG(value_for_money_rating)::numeric, 2) as avg_value_for_money_rating,
  COUNT(CASE WHEN overall_rating = 5 THEN 1 END) as five_star_count,
  COUNT(CASE WHEN overall_rating = 4 THEN 1 END) as four_star_count,
  COUNT(CASE WHEN overall_rating = 3 THEN 1 END) as three_star_count,
  COUNT(CASE WHEN overall_rating = 2 THEN 1 END) as two_star_count,
  COUNT(CASE WHEN overall_rating = 1 THEN 1 END) as one_star_count,
  MAX(created_at) as last_rated_at
FROM seller_ratings
GROUP BY seller_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_seller_rating_stats_seller_id ON seller_rating_stats(seller_id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_seller_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY seller_rating_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh stats when ratings change
CREATE TRIGGER trigger_refresh_seller_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON seller_ratings
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_seller_rating_stats();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_rating_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_seller_rating_updated_at
BEFORE UPDATE ON seller_ratings
FOR EACH ROW
EXECUTE FUNCTION update_seller_rating_updated_at();

-- Add RLS policies
ALTER TABLE seller_ratings ENABLE ROW LEVEL SECURITY;

-- Buyers can view all ratings
CREATE POLICY "Buyers can view all ratings"
  ON seller_ratings FOR SELECT
  USING (true);

-- Buyers can insert their own ratings
CREATE POLICY "Buyers can insert their own ratings"
  ON seller_ratings FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Buyers can update their own ratings
CREATE POLICY "Buyers can update their own ratings"
  ON seller_ratings FOR UPDATE
  USING (auth.uid() = buyer_id);

-- Sellers can update their response on ratings for their products
CREATE POLICY "Sellers can respond to their ratings"
  ON seller_ratings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id AND
    seller_response IS NOT NULL
  );

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
  ON seller_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create helpful_votes table for rating helpfulness
CREATE TABLE IF NOT EXISTS rating_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES seller_ratings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(rating_id, user_id)
);

-- Create index for helpful votes
CREATE INDEX idx_rating_helpful_votes_rating_id ON rating_helpful_votes(rating_id);
CREATE INDEX idx_rating_helpful_votes_user_id ON rating_helpful_votes(user_id);

-- Add RLS for helpful votes
ALTER TABLE rating_helpful_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all helpful votes"
  ON rating_helpful_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own helpful votes"
  ON rating_helpful_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own helpful votes"
  ON rating_helpful_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update helpful count
CREATE OR REPLACE FUNCTION update_rating_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_helpful THEN
      UPDATE seller_ratings SET helpful_count = helpful_count + 1 WHERE id = NEW.rating_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_helpful AND NOT NEW.is_helpful THEN
      UPDATE seller_ratings SET helpful_count = helpful_count - 1 WHERE id = NEW.rating_id;
    ELSIF NOT OLD.is_helpful AND NEW.is_helpful THEN
      UPDATE seller_ratings SET helpful_count = helpful_count + 1 WHERE id = NEW.rating_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_helpful THEN
      UPDATE seller_ratings SET helpful_count = helpful_count - 1 WHERE id = OLD.rating_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for helpful count
CREATE TRIGGER trigger_update_rating_helpful_count
AFTER INSERT OR UPDATE OR DELETE ON rating_helpful_votes
FOR EACH ROW
EXECUTE FUNCTION update_rating_helpful_count();

-- Create badges table for gamification
CREATE TABLE IF NOT EXISTS seller_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  badge_name VARCHAR(100) NOT NULL,
  badge_description TEXT,
  badge_icon VARCHAR(50),
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(seller_id, badge_type)
);

-- Create index for badges
CREATE INDEX idx_seller_badges_seller_id ON seller_badges(seller_id);

-- Add RLS for badges
ALTER TABLE seller_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active badges"
  ON seller_badges FOR SELECT
  USING (is_active = true);

CREATE POLICY "Sellers can view their own badges"
  ON seller_badges FOR SELECT
  USING (auth.uid() = seller_id);

-- Create function to award badges based on ratings
CREATE OR REPLACE FUNCTION award_seller_badges()
RETURNS TRIGGER AS $$
DECLARE
  seller_stats RECORD;
BEGIN
  -- Get seller stats
  SELECT * INTO seller_stats
  FROM seller_rating_stats
  WHERE seller_id = NEW.seller_id;
  
  -- Award badges based on criteria
  -- 5-star seller badge
  IF seller_stats.avg_overall_rating >= 4.8 AND seller_stats.total_ratings >= 10 THEN
    INSERT INTO seller_badges (seller_id, badge_type, badge_name, badge_description, badge_icon)
    VALUES (NEW.seller_id, 'five_star_seller', '5-Star Seller', 'Maintained 4.8+ average rating with 10+ reviews', '⭐')
    ON CONFLICT (seller_id, badge_type) DO NOTHING;
  END IF;
  
  -- Communication champion badge
  IF seller_stats.avg_communication_rating >= 4.5 AND seller_stats.total_ratings >= 5 THEN
    INSERT INTO seller_badges (seller_id, badge_type, badge_name, badge_description, badge_icon)
    VALUES (NEW.seller_id, 'communication_champion', 'Communication Champion', 'Excellent communication with buyers', '💬')
    ON CONFLICT (seller_id, badge_type) DO NOTHING;
  END IF;
  
  -- Fast shipper badge
  IF seller_stats.avg_delivery_speed_rating >= 4.5 AND seller_stats.total_ratings >= 5 THEN
    INSERT INTO seller_badges (seller_id, badge_type, badge_name, badge_description, badge_icon)
    VALUES (NEW.seller_id, 'fast_shipper', 'Fast Shipper', 'Consistently fast delivery times', '🚀')
    ON CONFLICT (seller_id, badge_type) DO NOTHING;
  END IF;
  
  -- Quality products badge
  IF seller_stats.avg_product_quality_rating >= 4.5 AND seller_stats.total_ratings >= 5 THEN
    INSERT INTO seller_badges (seller_id, badge_type, badge_name, badge_description, badge_icon)
    VALUES (NEW.seller_id, 'quality_products', 'Quality Products', 'High-quality products consistently', '✨')
    ON CONFLICT (seller_id, badge_type) DO NOTHING;
  END IF;
  
  -- Rising star badge (new seller with great ratings)
  IF seller_stats.total_ratings >= 3 AND seller_stats.avg_overall_rating >= 4.5 THEN
    INSERT INTO seller_badges (seller_id, badge_type, badge_name, badge_description, badge_icon)
    VALUES (NEW.seller_id, 'rising_star', 'Rising Star', 'New seller with excellent ratings', '🌟')
    ON CONFLICT (seller_id, badge_type) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to award badges after rating
CREATE TRIGGER trigger_award_seller_badges
AFTER INSERT OR UPDATE ON seller_ratings
FOR EACH ROW
EXECUTE FUNCTION award_seller_badges();

-- Create rating_reminders table to track reminder notifications
CREATE TABLE IF NOT EXISTS rating_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_count INTEGER DEFAULT 0,
  last_reminded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(order_id, buyer_id)
);

-- Create index for rating reminders
CREATE INDEX idx_rating_reminders_order_id ON rating_reminders(order_id);
CREATE INDEX idx_rating_reminders_buyer_id ON rating_reminders(buyer_id);

-- Add RLS for rating reminders
ALTER TABLE rating_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
  ON rating_reminders FOR SELECT
  USING (auth.uid() = buyer_id);

-- Add comments for documentation
COMMENT ON TABLE seller_ratings IS 'Stores multi-dimensional seller ratings with review content and seller responses';
COMMENT ON TABLE rating_helpful_votes IS 'Tracks helpfulness votes on seller ratings';
COMMENT ON TABLE seller_badges IS 'Stores gamification badges earned by sellers based on ratings';
COMMENT ON TABLE rating_reminders IS 'Tracks rating reminder notifications sent to buyers';
COMMENT ON MATERIALIZED VIEW seller_rating_stats IS 'Aggregated seller rating statistics for performance';

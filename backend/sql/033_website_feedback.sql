-- Website Feedback System
-- Stores user feedback and ratings for the platform experience

-- Table to store user feedback about the website
CREATE TABLE IF NOT EXISTS website_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_type TEXT NOT NULL DEFAULT 'general',
  feedback_text TEXT,
  would_recommend BOOLEAN,
  improved_features TEXT[],
  is_satisfied BOOLEAN,
  page_url TEXT,
  session_duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_website_feedback_created_at ON website_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_feedback_rating ON website_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_website_feedback_user_id ON website_feedback(user_id);

-- Enable RLS
ALTER TABLE website_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (users don't need to be logged in to submit)
CREATE POLICY "Allow anyone to insert website feedback"
  ON website_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow admins to read all feedback
CREATE POLICY "Allow admins to read website feedback"
  ON website_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow users to read their own feedback
CREATE POLICY "Allow users to read own website feedback"
  ON website_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to get top testimonials (highest rated reviews with feedback text)
CREATE OR REPLACE FUNCTION get_top_testimonials(limit_count INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  rating INTEGER,
  feedback_text TEXT,
  would_recommend BOOLEAN,
  created_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT,
  department TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wf.id,
    wf.user_id,
    wf.rating,
    wf.feedback_text,
    wf.would_recommend,
    wf.created_at,
    u.full_name,
    u.avatar_url,
    u.department
  FROM website_feedback wf
  LEFT JOIN users u ON wf.user_id = u.id
  WHERE wf.feedback_text IS NOT NULL 
    AND wf.feedback_text != ''
    AND wf.rating >= 4
  ORDER BY wf.rating DESC, wf.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get feedback stats for admin dashboard
CREATE OR REPLACE FUNCTION get_feedback_stats()
RETURNS TABLE (
  total_feedback INTEGER,
  avg_rating NUMERIC,
  five_star_count INTEGER,
  four_star_count INTEGER,
  three_star_count INTEGER,
  two_star_count INTEGER,
  one_star_count INTEGER,
  recommend_percentage NUMERIC,
  satisfied_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_feedback,
    COALESCE(AVG(rating), 0)::NUMERIC(3,2) AS avg_rating,
    COUNT(*) FILTER (WHERE rating = 5)::INTEGER AS five_star_count,
    COUNT(*) FILTER (WHERE rating = 4)::INTEGER AS four_star_count,
    COUNT(*) FILTER (WHERE rating = 3)::INTEGER AS three_star_count,
    COUNT(*) FILTER (WHERE rating = 2)::INTEGER AS two_star_count,
    COUNT(*) FILTER (WHERE rating = 1)::INTEGER AS one_star_count,
    COALESCE((COUNT(*) FILTER (WHERE would_recommend = true)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE would_recommend IS NOT NULL), 0) * 100), 0)::NUMERIC(5,2) AS recommend_percentage,
    COALESCE((COUNT(*) FILTER (WHERE is_satisfied = true)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE is_satisfied IS NOT NULL), 0) * 100), 0)::NUMERIC(5,2) AS satisfied_percentage
  FROM website_feedback;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
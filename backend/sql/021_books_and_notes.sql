-- Create books_and_notes table for campus textbooks and notes
CREATE TABLE IF NOT EXISTS books_and_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Book specific fields
  isbn VARCHAR(20),
  author VARCHAR(255),
  edition VARCHAR(100),
  publisher VARCHAR(255),
  
  -- Categorization
  book_type VARCHAR(50) NOT NULL,  -- 'textbook', 'notebook', 'guide', 'past_questions', 'handout', 'lecture_notes'
  subject VARCHAR(100),  -- e.g., 'Mathematics', 'Physics', 'Business'
  course_code VARCHAR(50),  -- e.g., 'MATH101', 'PHY100'
  academic_level VARCHAR(50),  -- '100', '200', '300', '400', 'graduate'
  
  -- Condition and pricing
  condition VARCHAR(20) NOT NULL,  -- 'new', 'like_new', 'good', 'fair', 'poor'
  price DECIMAL(10,2) NOT NULL,
  price_negotiable BOOLEAN DEFAULT true,
  
  -- Details
  page_count INTEGER,
  language VARCHAR(50) DEFAULT 'English',
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
ALTER TABLE books_and_notes ENABLE ROW LEVEL SECURITY;

-- Users can view all active books
CREATE POLICY "Anyone can view active books_and_notes" ON books_and_notes
  FOR SELECT USING (is_active = true);

-- Users can view their own books
CREATE POLICY "Users can view own books_and_notes" ON books_and_notes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own books
CREATE POLICY "Users can insert books_and_notes" ON books_and_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own books
CREATE POLICY "Users can update own books_and_notes" ON books_and_notes
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own books
CREATE POLICY "Users can delete own books_and_notes" ON books_and_notes
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books_and_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_books_book_type ON books_and_notes(book_type);
CREATE INDEX IF NOT EXISTS idx_books_subject ON books_and_notes(subject);
CREATE INDEX IF NOT EXISTS idx_books_course_code ON books_and_notes(course_code);
CREATE INDEX IF NOT EXISTS idx_books_academic_level ON books_and_notes(academic_level);
CREATE INDEX IF NOT EXISTS idx_books_condition ON books_and_notes(condition);
CREATE INDEX IF NOT EXISTS idx_books_is_active ON books_and_notes(is_active);
CREATE INDEX IF NOT EXISTS idx_books_is_sold ON books_and_notes(is_sold);

-- Create book_reviews table
CREATE TABLE IF NOT EXISTS book_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books_and_notes(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS for book reviews
ALTER TABLE book_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view book reviews" ON book_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert book reviews" ON book_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Create indexes for reviews
CREATE INDEX IF NOT EXISTS idx_book_reviews_book_id ON book_reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_book_reviews_reviewer_id ON book_reviews(reviewer_id);

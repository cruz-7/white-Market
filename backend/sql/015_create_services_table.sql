-- Create services table for campus service providers
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price VARCHAR(100),  -- Can be hourly rate, fixed price, or "From GHS X"
  price_type VARCHAR(20) DEFAULT 'fixed',  -- 'hourly', 'fixed', 'from'
  location VARCHAR(255),  -- Campus area or general location
  availability JSONB,  -- {"weekdays": "9am-5pm", "weekends": "10am-4pm"}
  response_time VARCHAR(100),  -- e.g., "< 1 hour", "Same day"
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Service providers can view their own services
CREATE POLICY "Users can view own services" ON services
  FOR SELECT USING (auth.uid() = user_id);

-- Service providers can insert their own services
CREATE POLICY "Users can insert own services" ON services
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service providers can update their own services
CREATE POLICY "Users can update own services" ON services
  FOR UPDATE USING (auth.uid() = user_id);

-- Service providers can delete their own services
CREATE POLICY "Users can delete own services" ON services
  FOR DELETE USING (auth.uid() = user_id);

-- Anyone can view active services (for browsing)
CREATE POLICY "Anyone can view active services" ON services
  FOR SELECT USING (is_active = true);

-- Create service_reviews table
CREATE TABLE IF NOT EXISTS service_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS for service reviews
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view service reviews" ON service_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert service reviews" ON service_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Create service_bookings table for service appointments
CREATE TABLE IF NOT EXISTS service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, completed, cancelled
  scheduled_date DATE,
  scheduled_time VARCHAR(50),
  notes TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS for service bookings
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings" ON service_bookings
  FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = provider_id);

CREATE POLICY "Users can create bookings" ON service_bookings
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Providers can update own bookings" ON service_bookings
  FOR UPDATE USING (auth.uid() = provider_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id ON service_reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_service_id ON service_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_provider_id ON service_bookings(provider_id);

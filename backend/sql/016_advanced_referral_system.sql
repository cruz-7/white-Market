-- Advanced Referral System Migration
-- White Market - Growth Engine

-- Prerequisites:
-- - Run `supabase/migrations/20260307_security_hardening.sql`
-- - Run `supabase/migrations/20260314_phase2_features.sql` (creates `public.referrals` and `public.notifications`)

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.referrals') is null then
    raise exception 'Missing table public.referrals. Run supabase/migrations/20260314_phase2_features.sql first.';
  end if;

  if to_regclass('public.notifications') is null then
    raise exception 'Missing table public.notifications. Run supabase/migrations/20260314_phase2_features.sql (or create notifications table) first.';
  end if;
end $$;

-- =========================
-- 1. Add new fields to users table for referral system
-- =========================

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS platform_credit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS commission_discount_sales_remaining INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_referrals INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS qualified_buyer_referrals INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS qualified_seller_referrals INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_level INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_campus_ambassador BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS referral_ambassador_discount_active BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================
-- 2. Update referrals table with new fields
-- =========================

ALTER TABLE public.referrals
ADD COLUMN IF NOT EXISTS referral_type TEXT CHECK (referral_type IN ('buyer_referral', 'seller_referral')),
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reward_type TEXT,
ADD COLUMN IF NOT EXISTS reward_given_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS purchase_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS seller_listed_at TIMESTAMPTZ;

-- =========================
-- 3. Create referral_rewards table
-- =========================

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('credit', 'commission_discount', 'milestone_credit', 'ambassador_permanent_discount')),
  reward_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS for referral_rewards
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral rewards" ON public.referral_rewards;
CREATE POLICY "Users can view own referral rewards" 
  ON public.referral_rewards FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage referral rewards" ON public.referral_rewards;
CREATE POLICY "Service role can manage referral rewards"
  ON public.referral_rewards FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================
-- 4. Create index for better query performance
-- =========================

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status ON public.referrals(referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_status ON public.referrals(referred_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_level ON public.users(referral_level);
CREATE INDEX IF NOT EXISTS idx_users_qualified_referrals ON public.users(qualified_buyer_referrals, qualified_seller_referrals);

-- =========================
-- 5. Update existing referral codes to use new format WM-XXXXXX
-- =========================

-- Update the generate_referral_code function to use WM- format
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate WM-XXXXXX format (6 random alphanumeric characters)
    v_code := 'WM-' || upper(
      substring(md5(random()::text) from 1 for 6)
    );
    SELECT EXISTS(SELECT 1 FROM public.referrals WHERE referral_code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- =========================
-- 6. Function to generate user referral code if not exists
-- =========================

CREATE OR REPLACE FUNCTION public.get_or_create_user_referral_code(user_id_input UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_referral RECORD;
BEGIN
  -- Check if user already has a referral code
  SELECT r.referral_code INTO v_code
  FROM public.referrals r
  WHERE r.referrer_id = user_id_input
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate new referral code
  v_code := public.generate_referral_code();

  -- Create self-referral record (this will be updated when someone uses the code)
  INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status)
  VALUES (user_id_input, user_id_input, v_code, 'pending')
  ON CONFLICT (referral_code) DO NOTHING;

  -- Update user's referral_code field
  UPDATE public.users 
  SET referral_code = v_code 
  WHERE id = user_id_input AND referral_code IS NULL;

  RETURN v_code;
END;
$$;

-- =========================
-- 7. Function to claim referral on signup
-- =========================

CREATE OR REPLACE FUNCTION public.claim_referral_on_signup(
  new_user_id UUID,
  referral_code_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- If no referral code, return success without referral
  IF referral_code_input IS NULL OR referral_code_input = '' THEN
    RETURN jsonb_build_object('success', true, 'message', 'No referral code provided');
  END IF;

  -- Find the referrer by code
  SELECT r.referrer_id INTO v_referrer_id
  FROM public.referrals r
  WHERE r.referral_code = upper(referral_code_input)
  LIMIT 1;

  -- If no valid referral code, return
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
  END IF;

  -- Can't refer yourself
  IF v_referrer_id = new_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot refer yourself');
  END IF;

  -- Check if this referral already exists
  IF EXISTS (
    SELECT 1 FROM public.referrals 
    WHERE referred_id = new_user_id 
    AND referrer_id = v_referrer_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already referred');
  END IF;

  -- Create referral record
  UPDATE public.referrals 
  SET referred_id = new_user_id, 
      status = 'pending',
      created_at = NOW()
  WHERE referrer_id = v_referrer_id 
  AND referred_id = referrer_id;

  -- If update didn't work (no self-referral), insert new
  IF NOT FOUND THEN
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status)
    VALUES (v_referrer_id, new_user_id, upper(referral_code_input), 'pending');
  END IF;

  -- Update referred user's referred_by field
  UPDATE public.users 
  SET referred_by = v_referrer_id 
  WHERE id = new_user_id;

  -- Increment referrer's total referrals
  UPDATE public.users 
  SET total_referrals = total_referrals + 1 
  WHERE id = v_referrer_id;

  -- Create notification for referrer
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_referrer_id, 
    'referral_signup', 
    '🎉 New Referral!', 
    'Someone just signed up using your referral code!',
    jsonb_build_object('referred_user_id', new_user_id, 'referral_code', upper(referral_code_input))
  );

  RETURN jsonb_build_object('success', true, 'message', 'Referral claimed successfully');
END;
$$;

-- =========================
-- 8. Function to process buyer referral qualification
-- =========================

CREATE OR REPLACE FUNCTION public.process_buyer_referral_qualification(
  buyer_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral RECORD;
  v_buyer_referrals INTEGER;
  v_reward_given BOOLEAN := FALSE;
BEGIN
  -- Find the referrer for this buyer
  SELECT u.referred_by INTO v_referrer_id
  FROM public.users u
  WHERE u.id = buyer_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No referrer found');
  END IF;

  -- Find the pending referral
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referrer_id = v_referrer_id 
  AND referred_id = buyer_user_id
  AND status = 'pending'
  LIMIT 1;

  IF v_referral.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No pending referral found');
  END IF;

  -- Update referral to qualified (buyer type)
  UPDATE public.referrals
  SET status = 'qualified',
      referral_type = 'buyer_referral',
      qualified_at = NOW(),
      purchase_completed_at = NOW()
  WHERE id = v_referral.id;

  -- Increment referrer's qualified buyer referrals
  UPDATE public.users
  SET qualified_buyer_referrals = qualified_buyer_referrals + 1
  WHERE id = v_referrer_id;

  -- Check for rewards (3 buyer referrals = GHS 5 credit)
  SELECT qualified_buyer_referrals INTO v_buyer_referrals
  FROM public.users
  WHERE id = v_referrer_id;

  -- Give reward if milestone reached (every 3 buyer referrals)
  IF v_buyer_referrals > 0 AND v_buyer_referrals % 3 = 0 THEN
    -- Give GHS 5 credit
    UPDATE public.users
    SET platform_credit = platform_credit + 5
    WHERE id = v_referrer_id;

    -- Record the reward
    INSERT INTO public.referral_rewards (user_id, referral_id, reward_type, reward_value, description)
    VALUES (v_referrer_id, v_referral.id, 'credit', '5', 'Buyer referral milestone reward (every 3 buyers)');

    -- Create notification
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_referrer_id,
      'referral_reward',
      '🎁 Referral Reward Earned!',
      'You earned GHS 5 platform credit! Keep inviting buyers to earn more.',
      jsonb_build_object('reward_type', 'credit', 'reward_value', '5')
    );

    v_reward_given := TRUE;
  END IF;

  -- Check milestone levels
  PERFORM public.check_and_award_referral_milestones(v_referrer_id);

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Buyer referral qualified',
    'reward_given', v_reward_given,
    'qualified_referrals', v_buyer_referrals
  );
END;
$$;

-- =========================
-- 9. Function to process seller referral qualification
-- =========================

CREATE OR REPLACE FUNCTION public.process_seller_referral_qualification(
  seller_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral RECORD;
  v_seller_referrals INTEGER;
  v_reward_given BOOLEAN := FALSE;
BEGIN
  -- Find the referrer for this seller
  SELECT u.referred_by INTO v_referrer_id
  FROM public.users u
  WHERE u.id = seller_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No referrer found');
  END IF;

  -- Find the pending referral
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referrer_id = v_referrer_id 
  AND referred_id = seller_user_id
  AND status = 'pending'
  LIMIT 1;

  IF v_referral.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No pending referral found');
  END IF;

  -- Update referral to qualified (seller type)
  UPDATE public.referrals
  SET status = 'qualified',
      referral_type = 'seller_referral',
      qualified_at = NOW(),
      seller_listed_at = NOW()
  WHERE id = v_referral.id;

  -- Increment referrer's qualified seller referrals
  UPDATE public.users
  SET qualified_seller_referrals = qualified_seller_referrals + 1
  WHERE id = v_referrer_id;

  -- Check for rewards (2 seller referrals = 0% commission for 10 sales)
  SELECT qualified_seller_referrals INTO v_seller_referrals
  FROM public.users
  WHERE id = v_referrer_id;

  -- Give reward if milestone reached (every 2 seller referrals)
  IF v_seller_referrals > 0 AND v_seller_referrals % 2 = 0 THEN
    -- Give 0% commission for 10 sales
    UPDATE public.users
    SET commission_discount_sales_remaining = commission_discount_sales_remaining + 10
    WHERE id = v_referrer_id;

    -- Record the reward
    INSERT INTO public.referral_rewards (user_id, referral_id, reward_type, reward_value, description)
    VALUES (v_referrer_id, v_referral.id, 'commission_discount', '10', 'Seller referral milestone reward (0% commission for 10 sales)');

    -- Create notification
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_referrer_id,
      'referral_reward',
      '🎁 Seller Referral Reward!',
      'You earned 0% commission for your next 10 sales! Keep inviting sellers to earn more.',
      jsonb_build_object('reward_type', 'commission_discount', 'reward_value', '10')
    );

    v_reward_given := TRUE;
  END IF;

  -- Check milestone levels
  PERFORM public.check_and_award_referral_milestones(v_referrer_id);

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Seller referral qualified',
    'reward_given', v_reward_given,
    'qualified_referrals', v_seller_referrals
  );
END;
$$;

-- =========================
-- 10. Function to check and award referral milestones
-- =========================

CREATE OR REPLACE FUNCTION public.check_and_award_referral_milestones(
  user_id_input UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_qualified INTEGER;
  v_current_level INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get current stats
  SELECT 
    COALESCE(qualified_buyer_referrals, 0) + COALESCE(qualified_seller_referrals, 0),
    COALESCE(referral_level, 0)
  INTO v_total_qualified, v_current_level
  FROM public.users
  WHERE id = user_id_input;

  -- Determine new level
  v_new_level := 0;
  IF v_total_qualified >= 50 THEN
    v_new_level := 4; -- Campus Ambassador
  ELSIF v_total_qualified >= 25 THEN
    v_new_level := 3;
  ELSIF v_total_qualified >= 10 THEN
    v_new_level := 2;
  ELSIF v_total_qualified >= 3 THEN
    v_new_level := 1;
  END IF;

  -- If level increased
  IF v_new_level > v_current_level THEN
    UPDATE public.users
    SET referral_level = v_new_level
    WHERE id = user_id_input;

    -- Level 2: GHS 20 credit
    IF v_new_level >= 2 AND v_current_level < 2 THEN
      UPDATE public.users
      SET platform_credit = platform_credit + 20
      WHERE id = user_id_input;

      INSERT INTO public.referral_rewards (user_id, reward_type, reward_value, description)
      VALUES (user_id_input, 'milestone_credit', '20', 'Milestone: 10 qualified referrals');

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        user_id_input, 'referral_reward', '🏆 Milestone Reached!',
        'Congratulations! You reached 10 qualified referrals and earned GHS 20 credit!',
        jsonb_build_object('milestone', 10, 'reward', '20 GHS credit')
      );
    END IF;

    -- Level 3: 0% commission for 20 sales
    IF v_new_level >= 3 AND v_current_level < 3 THEN
      UPDATE public.users
      SET commission_discount_sales_remaining = commission_discount_sales_remaining + 20
      WHERE id = user_id_input;

      INSERT INTO public.referral_rewards (user_id, reward_type, reward_value, description)
      VALUES (user_id_input, 'commission_discount', '20', 'Milestone: 25 qualified referrals');

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        user_id_input, 'referral_reward', '🏆 Milestone Reached!',
        'Amazing! You reached 25 qualified referrals and earned 0% commission for 20 sales!',
        jsonb_build_object('milestone', 25, 'reward', '0% commission for 20 sales')
      );
    END IF;

    -- Level 4: Campus Ambassador - permanent 5% discount
    IF v_new_level >= 4 AND v_current_level < 4 THEN
      UPDATE public.users
      SET is_campus_ambassador = TRUE,
          referral_ambassador_discount_active = TRUE
      WHERE id = user_id_input;

      INSERT INTO public.referral_rewards (user_id, reward_type, reward_value, description)
      VALUES (user_id_input, 'ambassador_permanent_discount', '5', 'Campus Ambassador: Permanent 5% discount');

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        user_id_input, 'referral_reward', '🎓 Campus Ambassador!',
        'Congratulations! You are now a Campus Ambassador! You get a permanent 5% commission discount!',
        jsonb_build_object('level', 4, 'reward', 'Permanent 5% discount')
      );
    END IF;
  END IF;
END;
$$;

-- =========================
-- 11. Function to get referral leaderboard
-- =========================

CREATE OR REPLACE FUNCTION public.get_referral_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  total_referrals INTEGER,
  qualified_referrals INTEGER,
  referral_level INTEGER,
  is_campus_ambassador BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY (u.qualified_buyer_referrals + u.qualified_seller_referrals) DESC, u.total_referrals DESC) AS rank,
    u.id,
    u.full_name,
    u.avatar_url,
    u.total_referrals,
    (COALESCE(u.qualified_buyer_referrals, 0) + COALESCE(u.qualified_seller_referrals, 0)) AS qualified_referrals,
    u.referral_level,
    u.is_campus_ambassador
  FROM public.users u
  WHERE u.total_referrals > 0
  ORDER BY qualified_referrals DESC, u.total_referrals DESC
  LIMIT limit_count;
END;
$$;

-- =========================
-- 12. Function to get user referral dashboard data
-- =========================

CREATE OR REPLACE FUNCTION public.get_referral_dashboard(user_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_referral_code TEXT;
  v_next_milestone INTEGER;
  v_next_reward TEXT;
  v_total_qualified INTEGER;
BEGIN
  -- Get user data
  SELECT * INTO v_user
  FROM public.users
  WHERE id = user_id_input;

  -- Get referral code
  SELECT public.get_or_create_user_referral_code(user_id_input) INTO v_referral_code;

  -- Calculate next milestone
  v_total_qualified := COALESCE(v_user.qualified_buyer_referrals, 0) + COALESCE(v_user.qualified_seller_referrals, 0);
  
  IF v_total_qualified < 3 THEN
    v_next_milestone := 3;
    v_next_reward := 'GHS 5 platform credit';
  ELSIF v_total_qualified < 10 THEN
    v_next_milestone := 10;
    v_next_reward := 'GHS 20 platform credit';
  ELSIF v_total_qualified < 25 THEN
    v_next_milestone := 25;
    v_next_reward := '0% commission for 20 sales';
  ELSIF v_total_qualified < 50 THEN
    v_next_milestone := 50;
    v_next_reward := 'Campus Ambassador badge + permanent 5% discount';
  ELSE
    v_next_milestone := NULL;
    v_next_reward := 'Max level reached!';
  END IF;

  RETURN jsonb_build_object(
    'referral_code', v_referral_code,
    'referral_link', 'https://whitemarket.com/signup?ref=' || v_referral_code,
    'total_referrals', v_user.total_referrals,
    'qualified_buyer_referrals', COALESCE(v_user.qualified_buyer_referrals, 0),
    'qualified_seller_referrals', COALESCE(v_user.qualified_seller_referrals, 0),
    'total_qualified', v_total_qualified,
    'platform_credit', COALESCE(v_user.platform_credit, 0),
    'commission_discount_remaining', COALESCE(v_user.commission_discount_sales_remaining, 0),
    'referral_level', COALESCE(v_user.referral_level, 0),
    'is_campus_ambassador', v_user.is_campus_ambassador,
    'next_milestone', v_next_milestone,
    'next_reward', v_next_reward,
    'progress_to_next', CASE 
      WHEN v_next_milestone IS NOT NULL THEN 
        ROUND((v_total_qualified::numeric / v_next_milestone::numeric) * 100)
      ELSE 100 
    END
  );
END;
$$;

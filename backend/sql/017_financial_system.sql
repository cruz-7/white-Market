-- ================================
-- FINANCIAL SYSTEM (PRODUCTION)
-- ================================

-- 1. USER FINANCIAL FIELDS
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_credit DECIMAL(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_weight DECIMAL(3,2) DEFAULT 0.3 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_sales DECIMAL(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS successful_transactions INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sale_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_pin VARCHAR(4);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_payout_frozen BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fraud_flags TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_earnings DECIMAL(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referral_credits DECIMAL(15,2) DEFAULT 0 NOT NULL;

-- 1a. Wallet non-negative constraint (PostgreSQL compatible)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'check_wallet_balance'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_wallet_balance CHECK (wallet_balance >= 0);
    END IF;
END$$;

-- ================================
-- 2. ORDERS UPDATE
-- ================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission DECIMAL(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_earning DECIMAL(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_used DECIMAL(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) DEFAULT 'pending';

-- ================================
-- 3. TRANSACTIONS (IDEMPOTENT)
-- ================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES users(id),
  seller_id UUID REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  amount DECIMAL(15,2) NOT NULL,
  commission DECIMAL(15,2) NOT NULL,
  seller_earning DECIMAL(15,2) NOT NULL,
  paystack_reference VARCHAR(100) UNIQUE,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- 4. WALLET LEDGER
-- ================================
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  entry_type VARCHAR(10), -- credit/debit
  amount DECIMAL(15,2),
  balance_after DECIMAL(15,2),
  reference_id UUID,
  reference_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- 5. PAYOUTS
-- ================================
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount DECIMAL(15,2),
  net_amount DECIMAL(15,2),
  momo_number VARCHAR(15),
  network VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- 6. SYSTEM SETTINGS
-- ================================
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT
);

INSERT INTO system_settings (key, value) VALUES
('commission_rate', '0.10'),
('withdrawal_percentage', '0.50')
ON CONFLICT DO NOTHING;

-- ================================
-- 7. WALLET UPDATE FUNCTION
-- ================================
CREATE OR REPLACE FUNCTION update_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL,
  p_type VARCHAR,
  p_ref_id UUID,
  p_ref_type VARCHAR
)
RETURNS VOID AS $$
DECLARE
  current_balance DECIMAL;
  new_balance DECIMAL;
BEGIN
  SELECT wallet_balance INTO current_balance
  FROM users WHERE id = p_user_id
  FOR UPDATE;

  IF p_type = 'credit' THEN
    new_balance := current_balance + p_amount;
  ELSE
    new_balance := current_balance - p_amount;
    IF new_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
  END IF;

  UPDATE users SET wallet_balance = new_balance WHERE id = p_user_id;

  INSERT INTO wallet_ledger (
    user_id, entry_type, amount, balance_after,
    reference_id, reference_type
  )
  VALUES (
    p_user_id, p_type, p_amount, new_balance,
    p_ref_id, p_ref_type
  );
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 8. FRAUD DETECTION
-- ================================
CREATE OR REPLACE FUNCTION detect_fraud(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tx_count INT;
BEGIN
  SELECT COUNT(*) INTO tx_count
  FROM transactions
  WHERE seller_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF tx_count > 20 THEN
    UPDATE users
    SET fraud_flags = array_append(fraud_flags, 'high_velocity'),
        is_payout_frozen = true
    WHERE id = p_user_id;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 9. ACCOUNT WEIGHT
-- ================================
CREATE OR REPLACE FUNCTION calculate_account_weight(user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  sales DECIMAL;
BEGIN
  SELECT total_sales INTO sales FROM users WHERE id = user_id;

  IF sales >= 1000 THEN RETURN 1.0;
  ELSIF sales >= 200 THEN RETURN 0.6;
  ELSE RETURN 0.3;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for account weight
CREATE OR REPLACE FUNCTION update_account_weight_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.account_weight := calculate_account_weight(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_account_weight
BEFORE UPDATE OF total_sales ON users
FOR EACH ROW
EXECUTE FUNCTION update_account_weight_trigger();

-- ================================
-- 10. PAYMENT PROCESSING
-- ================================
CREATE OR REPLACE FUNCTION process_order_payment(
  p_order_id UUID,
  p_payment_reference VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_commission DECIMAL;
  v_seller_earning DECIMAL;
BEGIN
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE paystack_reference = p_payment_reference
  ) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  v_commission := v_order.amount * 0.10;
  v_seller_earning := v_order.amount - v_commission;

  UPDATE orders
  SET status = 'paid',
      commission = v_commission,
      seller_earning = v_seller_earning
  WHERE id = p_order_id;

  PERFORM update_wallet_balance(
    v_order.seller_id,
    v_seller_earning,
    'credit',
    p_order_id,
    'order'
  );

  INSERT INTO transactions (
    buyer_id, seller_id, order_id,
    amount, commission, seller_earning,
    paystack_reference, status
  )
  VALUES (
    v_order.buyer_id,
    v_order.seller_id,
    p_order_id,
    v_order.amount,
    v_commission,
    v_seller_earning,
    p_payment_reference,
    'paid'
  );

  PERFORM detect_fraud(v_order.seller_id);

  RETURN jsonb_build_object(
    'ok', true,
    'commission', v_commission,
    'seller_earning', v_seller_earning
  );
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 11. WITHDRAWAL VALIDATION
-- ================================
CREATE OR REPLACE FUNCTION validate_withdrawal(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
DECLARE
  balance DECIMAL;
BEGIN
  SELECT wallet_balance INTO balance FROM users WHERE id = p_user_id;

  IF p_amount > balance THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 12. REQUEST PAYOUT
-- ================================
CREATE OR REPLACE FUNCTION request_payout(
  p_user_id UUID,
  p_amount DECIMAL,
  p_momo VARCHAR,
  p_network VARCHAR
)
RETURNS UUID AS $$
DECLARE
  payout_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id AND is_payout_frozen = true
  ) THEN
    RAISE EXCEPTION 'Account frozen';
  END IF;

  PERFORM validate_withdrawal(p_user_id, p_amount);

  PERFORM update_wallet_balance(
    p_user_id,
    p_amount,
    'debit',
    NULL,
    'payout'
  );

  INSERT INTO payouts (
    user_id, amount, net_amount,
    momo_number, network
  )
  VALUES (
    p_user_id, p_amount, p_amount,
    p_momo, p_network
  )
  RETURNING id INTO payout_id;

  RETURN payout_id;
END;
$$ LANGUAGE plpgsql;
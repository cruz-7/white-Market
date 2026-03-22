-- =========================================
-- REALTIME CHAT TABLES
-- =========================================

-- =========================
-- CONVERSATIONS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  last_message_id UUID,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, buyer_id, seller_id)
);

-- =========================
-- MESSAGES TABLE UPDATE
-- =========================
-- Ensure messages table has all required columns for realtime chat
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';

-- Add image_url column if not exists
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- =========================
-- ENABLE ROW LEVEL SECURITY
-- =========================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- =========================
-- CONVERSATIONS POLICIES
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view own conversations'
  ) THEN
    CREATE POLICY "Users can view own conversations" ON conversations
      FOR SELECT USING (
        buyer_id = auth.uid() OR seller_id = auth.uid()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can create conversations'
  ) THEN
    CREATE POLICY "Users can create conversations" ON conversations
      FOR INSERT WITH CHECK (
        buyer_id = auth.uid() OR seller_id = auth.uid()
      );
  END IF;
END $$;

-- =========================
-- UPDATE MESSAGES POLICIES
-- =========================
-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own message status" ON messages
  FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_product ON conversations(product_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);

-- =========================
-- PUBLICATION FOR REALTIME
-- =========================
-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- =========================================
-- DONE ✅ REALTIME CHAT SETUP
-- =========================================

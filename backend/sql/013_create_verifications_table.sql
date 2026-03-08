-- Student Verification System
-- Adds verification functionality for student ID verification

-- Add verification fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'none';

-- Create verifications table for storing uploaded documents
CREATE TABLE IF NOT EXISTS public.verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  document_url text,
  document_type text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Policies for verifications
DROP POLICY IF EXISTS "Users can view own verification" ON public.verifications;
CREATE POLICY "Users can view own verification" ON public.verifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create verification" ON public.verifications;
CREATE POLICY "Users can create verification" ON public.verifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin can view all verifications
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.verifications;
CREATE POLICY "Admins can view all verifications" ON public.verifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin can update verifications
DROP POLICY IF EXISTS "Admins can update verifications" ON public.verifications;
CREATE POLICY "Admins can update verifications" ON public.verifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON public.verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON public.verifications(status);

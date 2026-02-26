-- Set admin role for the main admin user
-- Run in Supabase SQL Editor

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'reavugla@st.ug.edu.gh';

-- Verify
SELECT id, email, role FROM public.users WHERE email = 'reavugla@st.ug.edu.gh';

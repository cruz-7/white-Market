# White Market Setup Guide

## 1) Prerequisites

- Node.js 20+
- Supabase project
- Paystack account (for live payments/payouts)

## 2) Environment Files

### Frontend
Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_PAYSTACK_PUBLIC_KEY=...
```

### Backend
Create `backend/.env` from `backend/.env.example`:

```env
NODE_ENV=development
PORT=5000

SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

FRONTEND_URL=http://localhost:5173
ALLOWED_EMAIL_DOMAINS=st.ug.edu.gh,ug.edu.gh

PAYSTACK_SECRET_KEY=...
PAYSTACK_CALLBACK_URL=http://localhost:5173/payments/callback

ENABLE_TEST_ROUTES=true
ALLOW_SIMULATED_WALLET_TOPUP=true
```

## 3) Database Migration Order (Supabase SQL Editor)

Run:

1. `supabase/migrations/20260307_security_hardening.sql`
2. `supabase/migrations/20260308_payment_atomicity.sql`
3. `supabase/migrations/20260314_phase2_features.sql`

Notes:
- These are the canonical migrations.
- Legacy files under `backend/sql` are for historical/dev bootstrapping and include testing-era settings.

If you see an error like `Could not find the table 'public.notifications' in the schema cache`, it means
you have not applied the Phase 2 migration (or your Supabase REST schema cache has not reloaded yet).

## 4) Start Services

### Backend
```bash
cd backend
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

## 5) Production Checklist

Run validation before deploy:

```bash
# from repo root
npm run check
```

1. Set `NODE_ENV=production`.
2. Set non-empty `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`.
3. Set `ENABLE_TEST_ROUTES=false`.
4. Keep `ALLOW_SIMULATED_WALLET_TOPUP` unset or `false`.
5. Configure your Paystack webhook to `POST /payments/webhook`.
6. Ensure `FRONTEND_URL` and `PAYSTACK_CALLBACK_URL` use your hosted domain, not `localhost`.

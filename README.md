# White Market

White Market is a campus marketplace with:
- Vite + React frontend (`/frontend/src`)
- Express + Supabase backend (`/backend/src`)
- Supabase SQL migrations (`/supabase/migrations`)

## Quick Start

1. Install dependencies:
```bash
cd frontend && npm install
cd ../backend && npm install
```

2. Create env files:
- Copy `frontend/.env.example` to `frontend/.env`
- Copy `backend/.env.example` to `backend/.env`

3. Run database migrations in Supabase SQL editor:
- `supabase/migrations/20260307_security_hardening.sql`
- `supabase/migrations/20260308_payment_atomicity.sql`

4. Start backend:
```bash
cd backend
npm run dev
```

5. Start frontend:
```bash
cd frontend
npm run dev
```

## Validation

Run before deploy:

```bash
# from repo root
npm run check
```

## Production Notes

- Set `NODE_ENV=production` in backend.
- Set `FRONTEND_URL`, `PAYSTACK_CALLBACK_URL`, `PAYSTACK_SECRET_KEY`, and `SUPABASE_*` env vars.
- Do not leave production URLs as `localhost`.
- Test/debug routes are disabled in production by default.
- Simulated wallet top-up is blocked in production unless `ALLOW_SIMULATED_WALLET_TOPUP=true`.

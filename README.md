# White Market

White Market is a campus marketplace with:
- Vite + React frontend (`/src`)
- Express + Supabase backend (`/backend/src`)
- Supabase SQL migrations (`/supabase/migrations`)

## Quick Start

1. Install dependencies:
```bash
npm install
cd backend && npm install
```

2. Create env files:
- Copy [`.env.example`](C:/Users/cruz/Desktop/white%20matket/.env.example) to `.env`
- Copy [`backend/.env.example`](C:/Users/cruz/Desktop/white%20matket/backend/.env.example) to `backend/.env`

3. Run database migration in Supabase SQL editor:
- `supabase/migrations/20260307_security_hardening.sql`

4. Start backend:
```bash
cd backend
npm run dev
```

5. Start frontend:
```bash
npm run dev
```

## Validation

Run before deploy:

```bash
npm run check
cd backend
npm run check
```

## Production Notes

- Set `NODE_ENV=production` in backend.
- Set `FRONTEND_URL`, `PAYSTACK_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`, and `SUPABASE_*` env vars.
- Test/debug routes are disabled in production by default.
- Simulated wallet top-up is blocked in production unless `ALLOW_SIMULATED_WALLET_TOPUP=true`.

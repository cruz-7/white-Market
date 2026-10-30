# White Market

White Market is a campus marketplace built with React, Vite, and Convex.

## Architecture

```text
React + Vite frontend
        |
      Convex
  /      |       \
Database Auth  Functions
                  |
          Marketplace operations
       Listings, orders, reviews, etc.
                  |
               Paystack
         (payment processing)
```

Convex is the application backend for database access, authentication, and
marketplace functions. Paystack remains the external payment provider; its
secret key must only be configured in the Convex deployment environment.

## Quick Start

1. Install frontend dependencies:
```bash
cd frontend
npm install
```

2. Connect the frontend to your Convex development project and start the
   Convex functions:
```bash
npx convex dev
```

For a first-time connection, use `npx convex dev --configure existing` and
select your Convex team and project.

3. In a second terminal, start the frontend:
```bash
npm run dev
```

4. Configure server-only secrets on the Convex deployment. For example:
```bash
npx convex env set PAYSTACK_SECRET_KEY your_paystack_secret
npx convex env set PAYSTACK_CALLBACK_URL http://localhost:5173/payment/callback
```

Use the Convex dashboard or CLI to configure any email provider secrets as
well. Never put secret keys in a `VITE_*` variable; Vite exposes those values
to browsers.

## Initial admin setup

New signups always receive the `user` role. To create the first administrator:

1. Sign up normally using the account that should be the administrator.
2. In the Convex dashboard for the correct deployment, open **Data → users**
   and locate that account by its email address.
3. Change only that user's `role` field to `admin`, then sign in again and
   verify access to `/admin`.

Repeat this step separately in production after deploying. Do not add an admin
role selector to public signup or trust a role supplied by the browser.

## Validation

Run local checks:

```bash
npm run check
```

`npm run check` runs frontend tests, typechecking, a preview build, and the
backend checks. CI also validates a production bundle with temporary
configuration values; that bundle is not deployed.

## Production Notes

- The current local Convex link is a development deployment. Do not use it for
  the production site or payments.
- Configure the production frontend build environment with:
  `CONVEX_DEPLOYMENT=prod:<deployment-name>`,
  `VITE_CONVEX_URL=https://<deployment-name>.convex.cloud`,
  `VITE_CONVEX_SITE_URL=https://<deployment-name>.convex.site`, and the real
  Paystack `VITE_PAYSTACK_PUBLIC_KEY` beginning with `pk_live_`. A production
  build fails if these values are missing, point to different deployments, or
  contain placeholders.
- For Vercel, set the project root to `frontend`, use `npm ci` to install,
  `npm run build` to build, and `dist` as the output directory. The checked-in
  `frontend/vercel.json` provides the SPA fallback for direct route loads.
  Configure Preview environment variables to use a development Convex
  deployment and a real Paystack test public key beginning with `pk_test_`;
  production variables must use the production Convex deployment and live
  Paystack public key.
- Configure the production Convex deployment with `PAYSTACK_SECRET_KEY`,
  `PAYSTACK_CALLBACK_URL=https://<your-domain>/payment/callback`,
  `FRONTEND_URL=https://<your-domain>`, and `RESEND_API_KEY` plus
  `AUTH_EMAIL_FROM` for password-reset email. Set
  `REQUIRE_AUTH_EMAIL_PROVIDER=true` so missing email configuration fails
  closed. Configure the Paystack webhook URL as
  `https://<deployment-name>.convex.site/paystack/webhook`. Keep all secret
  keys in Convex deployment environment variables, never in `VITE_*` variables.
- Deploy the Convex functions to the production deployment, then build and
  publish `frontend/dist` using the production frontend variables. Configure
  the frontend host to serve `index.html` for unknown paths so routes such as
  `/admin` and `/payment/callback` work when opened directly.
- Configure the production admin role separately in the production Convex
  database. Verify the production payment, reset-email, uploads, and admin
  flows before announcing the site.
- Legacy Express/Supabase folders remain in the repository during the
  migration and should not be treated as the source of truth for new Convex
  flows.

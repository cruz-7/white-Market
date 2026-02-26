# UG Hustle - Setup Guide

This guide will help you connect the frontend to the backend.

## Prerequisites

1. **Node.js** installed on your computer
2. A **Supabase** project (free tier works)
3. Basic knowledge of terminal/command line

---

## Step 1: Set Up Supabase Database

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in the details:
   - **Name**: ug-hustle
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Select one close to Ghana (e.g., EU or US)
4. Wait for the project to be created

### 1.2 Get Your Supabase Credentials
1. In your Supabase dashboard, go to **Project Settings** (gear icon)
2. Click **API**
3. Copy these values:
   - **Project URL** (e.g., `https://xyzabc123.supabase.co`)
   - **anon public** key (under "Project API keys")

### 1.3 Run the Database Migrations
1. In Supabase dashboard, click **SQL Editor** in the left sidebar
2. Copy and run each SQL file in this order:
   - `backend/sql/001_create_users.sql`
   - `backend/sql/002_create_products.sql`
   - `backend/sql/003_disable_products_rls_for_testing.sql`
   - `backend/sql/004_create_orders.sql`
   - `backend/sql/005_disable_orders_rls_for_testing.sql`
   - `backend/sql/006_enable_rls_and_core_policies.sql`
   - `backend/sql/007_add_payment_fields_to_orders.sql`
   - `backend/sql/008_add_momo_fields_to_users.sql`
   - `backend/sql/009_create_payouts_table.sql`
   - `backend/sql/010_add_paystack_recipient_to_users.sql`
   - `backend/sql/011_set_admin_role.sql`
   - `backend/sql/012_create_wallets_table.sql`

---

## Step 2: Configure Backend

### 2.1 Create Backend Environment File

Create a file named `.env` in the `backend` folder with these values:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

# Server Configuration
PORT=5000

# Paystack (Optional - for real payments)
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYMENT_WEBHOOK_SECRET=your_webhook_secret
```

**How to get the keys:**
- **SUPABASE_URL**: From Project Settings → API → Project URL
- **SUPABASE_SERVICE_ROLE_KEY**: From Project Settings → API → `service_role` (click to reveal)
- **SUPABASE_ANON_KEY**: From Project Settings → API →anon public

### 2.2 Install Backend Dependencies
```
bash
cd backend
npm install
```

### 2.3 Start the Backend Server
```
bash
npm run dev
```
You should see: `Backend running on http://localhost:5000`

---

## Step 3: Configure Frontend (Optional)

The frontend works in two modes:

### Mode 1: Local Demo Mode (Default)
- Uses localStorage - no setup needed
- Works offline
- Data persists in your browser

### Mode 2: Connected to Backend
To connect to your backend:

1. Create a `.env` file in the project root:
```
env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

2. Restart the frontend dev server:
```
bash
npm run dev
```

---

## Step 4: Test the Application

### Start Backend (Terminal 1)
```
bash
cd backend
npm run dev
```

### Start Frontend (Terminal 2)
```
bash
npm run dev
```

### Open in Browser
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

---

## Troubleshooting

### "Missing SUPABASE_URL" Error
- Make sure your `.env` file is in the correct location (backend folder)
- Restart the backend after creating the file

### "Network Error" in Frontend
- Make sure backend is running on port 5000
- Check the browser console for details

### SQL Errors in Supabase
- Make sure you're running the SQL files in order
- Check that you're not duplicate creating tables

---

## API Endpoints Available

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/signup | Register new user |
| POST | /auth/login | User login |
| GET | /products | List all products |
| POST | /products | Create product |
| GET | /orders/my-orders | Get buyer's orders |
| GET | /orders/sales | Get seller's sales |
| POST | /orders | Create order |
| GET | /protected/profile | Get user profile |
| GET | /protected/wallet | Get wallet balance |
| POST | /protected/wallet/topup | Top up wallet |
| POST | /protected/wallet/withdraw | Withdraw funds |

---

## Need Help?

If you encounter issues:
1. Check the browser console (F12)
2. Check the backend terminal for error messages
3. Verify your `.env` file has the correct values

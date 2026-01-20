# Fintech (BestCity Pay) - MVP Dev Preview

This repo is an Expo Router app wired to Supabase (Auth + DB) and Supabase Edge Functions for Paystack + bill payments.

## 1) Requirements
- Node.js LTS
- Expo CLI (`npm i -g expo`)

## 2) Configure env
Copy `.env.example` to `.env` and fill:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Do **not** put service role keys or Paystack secret keys in the mobile app.
Those must live in Supabase Edge Functions secrets.

## 3) Install & run
```bash
npm install
npm run start
```

## 4) Supabase Edge Functions
Edge functions live in `supabase/functions/*`.
Deploy them from your Supabase project:
```bash
supabase functions deploy --no-verify-jwt
```
(Use your preferred deploy flow; this repo keeps the function sources.)

## 5) MVP flow to demo
1. Register / Login
2. Wallet tab:
   - Fund wallet (shows Dedicated Virtual Account details from `paystack-dva`)
   - Recent transactions (ledger)
3. Bills:
   - Airtime / Data / Electricity (Paystack-backed)

## 6) Database reference exports
For review and versioning, DB exports are stored in `supabase/supabase_project/`:
- `rpc_functions.sql`
- `rls_policies.txt`
- `triggers.txt`
- `tables_columns.txt`

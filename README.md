# Ocklan

Mobile-first React + TypeScript app for calisthenics coaching, booking and client management.

## Current status

The first runnable slice includes:

- Public landing page with service discovery, process, Instagram content links and conversion CTA.
- Dynamic-looking service catalog sourced from `src/data/demoData.ts`.
- Booking form with validation and success state.
- Client area demo with active path, session balance, appointments and materials.
- Coach dashboard demo with metrics, agenda and quick management links.
- Supabase relational schema with role-aware RLS policies in `supabase/schema.sql`.

## Run locally

Node.js 20+ and npm are required.

```bash
npm install
npm run dev
```

The current workspace did not have Node/npm available during initial setup, so dependency installation and build validation must be run once Node is installed.

## Production configuration

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` after creating a Supabase project. Stripe Checkout, Google Calendar/Meet and transactional email should be implemented as server-side Edge Functions or a dedicated backend. Never put provider secret keys in the browser.

Demo content is intentionally separated from real data and can be replaced by Supabase queries as the next implementation step.

## Create client Edge Function

`supabase/functions/create-client/` contains a server-side, read/write-protected Edge Function for the future coach client-creation flow. It accepts only `email` and `full_name`, verifies the bearer session and reads `profiles.role` before allowing a `COACH` to create an invited Auth user. The existing `handle_new_user` trigger creates the related profile with the default `CLIENT` role; the function verifies that result and rolls back the Auth user if the profile is missing or has another role.

The function uses Supabase-managed `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. The service role key must remain an Edge Function secret and must never be added to the frontend `.env.local` or returned to the browser.

Deploy it after linking the project with:

```bash
supabase functions deploy create-client
```

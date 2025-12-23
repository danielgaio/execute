# Testing Guide

This project uses [Vitest](https://vitest.dev/) for testing.

## Prerequisites

### 1. Local Supabase Instance
The integration tests (RLS tests) require a running local Supabase instance because they test the database policies directly.

1.  Install Supabase CLI: `brew install supabase/tap/supabase` (or see [docs](https://supabase.com/docs/guides/cli))
2.  Start Supabase:
    ```bash
    npx supabase start
    ```

### 2. Environment Variables
The tests need to know how to connect to your local Supabase instance.

1.  Copy `.env.local.example` to `.env.local` (if you haven't already).
2.  Fill in the keys from the output of `npx supabase start`:
    *   `NEXT_PUBLIC_SUPABASE_URL`: API URL (usually `http://127.0.0.1:54321`)
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `anon` key
    *   `SUPABASE_SERVICE_ROLE_KEY`: `service_role` key

**Note:** The `SUPABASE_SERVICE_ROLE_KEY` is critical for creating test users and bypassing RLS during setup. Do not commit this key to git.

## Running Tests

### Run All Tests
```bash
pnpm test
```

### Run RLS Security Tests
```bash
pnpm test:rls
```

## Troubleshooting

### "Missing Supabase keys in environment variables"
*   Ensure `.env.local` exists in the root directory.
*   Ensure it contains `SUPABASE_SERVICE_ROLE_KEY`.
*   If you are running in CI, ensure these secrets are set in the repository settings.

### "Connection refused"
*   Ensure Supabase is running (`npx supabase status`).
*   Check if the port matches `NEXT_PUBLIC_SUPABASE_URL`.

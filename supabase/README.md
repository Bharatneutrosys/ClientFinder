# Supabase Setup

These files prepare Client Finder for a future Supabase migration. The current running app still uses localStorage and should continue working exactly as it does now.

## Files

- `schema.sql`: Creates the future database tables, indexes, foreign keys, and `updated_at` triggers.
- `seed.sql`: Optional demo organization, demo user placeholder, membership, and search presets.
- `README.md`: Setup and migration notes.

## Create a Supabase Project

1. Create a new Supabase project from the Supabase dashboard.
2. Open the SQL editor.
3. Run `schema.sql`.
4. Optionally run `seed.sql` for demo setup data.

Do not run this against production data until RLS policies and auth behavior are fully tested.

## Manual Verification Checklist

Use this checklist when creating the Supabase project:

- Create a Supabase project.
- Open the SQL Editor.
- Run `supabase/schema.sql`.
- Run `supabase/seed.sql` only if demo data is desired.
- Confirm core tables exist, including `organizations`, `prospects`, `saved_prospects`, `clients`, `client_documents`, `client_payments`, `client_access_records`, and `client_support_requests`.
- Confirm `updated_at` triggers exist on major mutable tables.
- Copy the Project URL.
- Copy the anon public key.
- Do not copy the service role key into frontend code.
- Add future config values in Vercel or a runtime config source.
- Keep `CLIENT_FINDER_STORAGE_MODE=localStorage` until a later migration task explicitly enables Supabase reads/writes.

## Future Environment Variables

Add these later when the app gets Supabase client configuration:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
CLIENT_FINDER_STORAGE_MODE=localStorage
SUPABASE_STORAGE_BUCKET=
```

Backend only later:

```text
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend/browser code. Do not commit real Supabase keys.

For the current static frontend, these names are read from `window.CLIENT_FINDER_CONFIG` or a local browser override for development. They are not read directly from Node-style `process.env` in the browser. If a build tool is added later, document any public frontend prefix required by that tool.

## Current Migration Status

This is preparation only.

- Current source of truth: localStorage.
- Supabase schema: documented and ready to create later.
- Authentication: not added yet.
- File upload: not added yet.
- Supabase client config exists as a safe browser placeholder.
- Storage mode defaults to `localStorage`.
- localStorage should remain the fallback until migration is complete and verified.

## Storage Mode

The viewer supports a storage mode flag for future migration:

```text
CLIENT_FINDER_STORAGE_MODE=localStorage
```

Supported planned values:

- `localStorage`: current default and active implementation.
- `supabase`: future Supabase implementation; currently falls back to localStorage if Supabase is not configured.
- `hybrid`: future sync mode; currently falls back to localStorage if Supabase is not configured.

For the static viewer, runtime config can be provided later through `window.CLIENT_FINDER_CONFIG`. The app also supports a local browser override named `CLIENT_FINDER_STORAGE_MODE` for development testing. If `SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing, the app automatically uses localStorage and does not show user-facing errors.

Next planned task: wire real Supabase reads/writes behind this feature flag while preserving localStorage fallback.

## Saved Prospects Supabase Mode

Saved prospects can be tested through Supabase without migrating clients or other app data.

Required runtime config:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
CLIENT_FINDER_STORAGE_MODE=supabase
CLIENT_FINDER_DEFAULT_ORG_ID=00000000-0000-4000-8000-000000000001
```

`CLIENT_FINDER_DEFAULT_ORG_ID` can use the demo organization from `seed.sql` during development, or a real organization id created in Supabase later. `CLIENT_FINDER_DEFAULT_USER_ID` is optional while auth is not implemented; if omitted, saved rows use `null` for user-owned fields.

When `CLIENT_FINDER_STORAGE_MODE=supabase`:

- Saved prospects are read from `saved_prospects` with joined `prospects`.
- New saved prospects upsert into `prospects` and `saved_prospects`.
- Saved prospect workflow updates, archive state, and removal attempt Supabase writes.
- Browser localStorage is still written first and remains the fallback.
- If Supabase fails, the app stays usable with localStorage and shows only a subtle status message.

Manual sync:

- The sidebar storage area shows `Sync Saved to Supabase` only when Supabase is configured and storage mode is `supabase`.
- Clicking it explicitly upserts current local saved prospects into Supabase.
- The app never auto-pushes all local saved prospects silently.

Rollback:

- Set `CLIENT_FINDER_STORAGE_MODE=localStorage` or remove the flag.
- Existing localStorage data remains available.
- Supabase rows are not deleted by rollback.

Auth warning:

- Authentication is not implemented yet.
- RLS is still future work and must be enabled before multi-user production use.
- Do not expose the service role key in frontend code.

## Security Notes

- Do not store raw passwords.
- `client_access_records` only has `secure_storage_reference`, username/email, status, and notes.
- Sensitive documents should use Supabase Storage or another secure file system later.
- `client_documents` stores references/links only.
- Payment tables must not store card numbers, bank credentials, or processor secrets.
- Enable and test Row Level Security before any multi-user production release.
- RLS should restrict organization-owned records through `organization_members`.

## RLS Plan

The schema includes RLS comments but does not enable policies yet because auth is not implemented. Once auth is added:

1. Link `users.auth_user_id` to Supabase `auth.uid()`.
2. Enable RLS on organization-owned tables.
3. Add policies that allow access only when the authenticated user is an active member of the row's `organization_id`.
4. Test owner/admin/member/viewer roles before enabling shared workspaces.

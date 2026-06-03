# Client Finder Production Readiness Checklist

Use this checklist before deploying or changing production configuration. The MVP remains localStorage-first unless storage mode is explicitly changed.

## Deployment

- Confirm Vercel deployment still uses the existing routing and server setup.
- Run the syntax checks before deploy:
  - `node --check server.js`
  - `node --check viewer/app.js`
  - `node --check viewer/ui.js`
  - `node --check viewer/searchConfig.js`
- Deploy only after the local smoke test passes.
- After deployment, open the live app and repeat the manual smoke test below.

## Environment Variables

- `GOOGLE_PLACES_API_KEY`: required for live Google Places search.
- `SERPAPI_KEY`: optional only if the current server/export workflow still supports it.
- `SUPABASE_URL`: future Supabase project URL.
- `SUPABASE_ANON_KEY`: future Supabase public anon key.
- `CLIENT_FINDER_STORAGE_MODE`: defaults to `localStorage`; set to `supabase` only for deliberate Supabase testing.
- `CLIENT_FINDER_DEFAULT_ORG_ID`: required only when Supabase mode needs a placeholder organization before auth.
- `SUPABASE_SERVICE_ROLE_KEY`: backend/admin jobs only. Never expose this in frontend code, browser bundles, or Vercel client-side env.

## Google Places API

- Confirm the key is present in Vercel environment variables.
- Confirm the key has the required Places permissions.
- Confirm billing/quota is configured.
- Test searches for:
  - Salon in Farmers Branch, TX
  - Cleaning Company in Los Angeles, CA
  - IT Staffing in Maine
- Confirm search errors show a friendly message and do not crash the page.

## Supabase Readiness

- Supabase is prepared but not the default production storage.
- Run `supabase/schema.sql` manually in the Supabase SQL editor when creating the database.
- Run `supabase/seed.sql` only when demo records are wanted.
- Confirm RLS is enabled and tested before any real multi-user release.
- Confirm organization-owned data is scoped by `organization_id`.
- Keep localStorage fallback available until migration is verified.

## localStorage Limitations

- localStorage is single-browser and single-user.
- Data is not automatically shared across devices or team members.
- Browser clearing, profile changes, or device loss can remove data.
- localStorage is not suitable for sensitive production team workflows.
- Export local backups before major usage, migration, or reset actions.

## Data Backup and Restore

- Use Settings or Data Safety to export a local backup before clearing or migrating data.
- Store backup files securely because they may include business notes, client records, payment references, and access references.
- Validate an imported backup before restore.
- Prefer merge restore unless a full replacement is intentional.
- After restore, refresh the page and confirm saved prospects, lists, clients, and settings still load.

## Security Warnings

- Do not store raw passwords.
- Do not store sensitive document contents in localStorage.
- Use secure password managers or encrypted storage for credentials later.
- Sensitive files should move to Supabase Storage or another secure file system before production team use.
- Supabase RLS is required before real multi-user release.
- The service role key is backend-only and must never be exposed to the frontend.

## Known MVP Limitations

- No login or enforced authentication yet.
- No true multi-user collaboration yet.
- Supabase migration is prepared but not fully active unless explicitly enabled.
- No automatic email sending.
- No real document upload.
- Contact enrichment is lightweight and does not perform aggressive crawling.
- Website, app, booking, social, and payment detection can be approximate.
- Saved records are still called Saved Prospects even when used for vendor or research workflows.

## Manual Smoke Test

1. Open the live app.
2. Run a Google Places search and confirm results load.
3. Open a prospect detail panel.
4. Save a prospect.
5. Add the prospect to a saved list.
6. Add an activity entry.
7. Set a next follow-up date.
8. Prepare or update a quote.
9. Convert an eligible prospect to a client.
10. Open the Clients page.
11. Confirm client tabs load: Overview, Project, Onboarding, Documents, Payments, Access, Handover, Support.
12. Add or update a document reference.
13. Add or update a payment record.
14. Add or update an access reference without storing a raw password.
15. Add a support request.
16. Export search results as CSV.
17. Export saved prospects as CSV.
18. Export a selected saved list as CSV.
19. Export clients as CSV.
20. Export a local backup from Settings or Data Safety.
21. Refresh the page and confirm saved data persists.

## Rollback Steps

- If Supabase mode causes issues, set `CLIENT_FINDER_STORAGE_MODE=localStorage`.
- If a deployment causes UI or search regressions, redeploy the last known good Vercel build.
- If local data is damaged, import the latest local backup using merge mode first.
- If merge restore is not enough, use replace restore only after exporting the current state.
- If API search fails after deploy, verify environment variables, API permissions, quota, and server logs before changing app code.

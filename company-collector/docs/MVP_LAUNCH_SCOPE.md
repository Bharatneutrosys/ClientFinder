# Client Finder MVP Launch Scope

Client Finder's first launch scope is personal/internal use. The goal is to validate real prospecting and client tracking workflows before public SaaS packaging, authentication, or full production database migration.

## MVP Supports

- Search businesses by city, state, and business type.
- Advanced filters for website, mobile app, booking system, social presence, phone availability, rating, reviews, and source.
- Business type presets and search modes.
- Website, mobile, booking, and opportunity qualification signals.
- Saved Prospects.
- Saved Lists.
- Outreach templates and copy-ready outreach.
- Activity and follow-up tracking.
- Quote preparation.
- Convert prospect to client.
- Client profile tracking.
- Client onboarding, project, handover, documents, payments, access references, and support tracking.
- CSV exports for search results, saved prospects, saved lists, clients, follow-ups, and priority prospects.
- localStorage backup and restore.
- Supabase architecture and feature-flag preparation.

## Not Included in MVP

- Multi-user login.
- Public SaaS launch.
- Automated email sending.
- Full Supabase production mode.
- Real file upload.
- Payment processing.
- Raw password storage.
- Advanced paid enrichment.
- Team permissions, billing, or subscriptions.

## Go / No-Go Checklist

### Go If

- Search works across the 3 pilot scenarios.
- 20 prospects can be saved and tracked.
- Saved Lists are usable for organizing pilot prospects.
- Follow-up workflow is usable.
- Outreach copy and quote prep are usable.
- Convert to Client works for at least one eligible prospect.
- Client profile tabs remain stable.
- Exports are clean and useful.
- Backup export works.
- No critical UI, data, search, or export issues remain open.

### No-Go If

- Search is unreliable across normal pilot searches.
- Saved data disappears or cannot be restored from backup.
- UI is confusing enough to block normal workflow.
- Export is broken or produces unusable CSV.
- The app crashes during search, save, follow-up, quote, conversion, or export.
- A critical data safety issue is found.

## Next Release Options

### Option A: Full Supabase Migration and Login

- Move saved prospects, clients, lists, workflow records, settings, and templates to Supabase.
- Add Supabase Auth.
- Add organization/workspace selection.
- Enforce RLS before team use.

### Option B: Better Enrichment and Detection

- Improve website, booking, social, and contact detection.
- Add safer contact-page enrichment.
- Add stronger enrichment review states.
- Consider paid enrichment only after pilot value is proven.

### Option C: More Polished CRM / Client Workflow

- Improve client profile editing.
- Add clearer project and support dashboards.
- Improve activity timelines and follow-up views.
- Add better quote and handover reporting.

### Option D: SaaS / Multi-User Packaging

- Add team onboarding.
- Add workspace settings.
- Add role-based controls.
- Add billing/subscription only after product workflow is validated.

## Recommended Order

1. Pilot fixes.
2. Supabase migration.
3. Auth/workspaces.
4. Better enrichment.
5. SaaS packaging.

## Launch Decision Notes

- Launch internally first.
- Keep localStorage default until Supabase migration and auth are proven.
- Do not store raw passwords.
- Export backups before pilot reset, migration, or destructive cleanup.
- Use the pilot issue log to decide whether the next release should focus on data infrastructure, enrichment quality, or workflow polish.

# Client Finder MVP Acceptance Test

Use this checklist before release or deployment changes. The MVP should remain localStorage-first unless storage mode is explicitly changed.

## Search

1. Search `Salon` in `Farmers Branch`, `TX`.
   - Confirm loading state appears.
   - Confirm results or a friendly empty/error state appears.
   - Confirm result rows show business type, phone, website status, and opportunity context.

2. Search `Cleaning Company` in `Los Angeles`, `CA`.
   - Use Search Mode: `Client Acquisition` or `Vendor / Supply Search`.
   - Set Booking System Condition to `No Booking System`.
   - Confirm filters do not crash the page.

3. Search `IT Staffing` in `ME`.
   - Use Search Mode: `Staffing / Consulting Research`.
   - Confirm website gaps are not required to review the records.

## Search Filters

1. Change Website Condition between `Any`, `Has Website = No`, and `Has Website = Yes`.
2. Change Mobile App Condition.
3. Change Booking System Condition.
4. Change Search Mode and confirm result labels update.
5. Use More Filters without cluttering the main search row.

## Prospect Workflow

1. Open a search result detail panel.
2. Save the prospect.
3. Hide the prospect, then restore it.
4. Archive a saved prospect, then unarchive it.
5. Create a saved list and add the prospect to it.
6. Run `Enrich Contact Info`.
7. Run `Check Website Quality`.
8. Add activity and confirm it appears in Activity.
9. Set Next Follow-Up and confirm it appears in Follow-Ups.
10. Prepare quote details and copy/mark quote actions.

## Client Workflow

1. Move a prospect to an eligible stage or accepted quote.
2. Convert the prospect to a client.
3. Open Clients.
4. Edit client overview fields.
5. Update onboarding checklist.
6. Update project tracker.
7. Add a document reference.
8. Add a payment record.
9. Add an access reference without storing raw passwords.
10. Update handover.
11. Add a support request.

## Exports

1. Export current search results.
2. Export saved prospects.
3. Export selected saved list.
4. Export clients.
5. Confirm CSV files escape commas, quotes, and newlines.

## Persistence

1. Save at least one prospect, list, client, activity, quote, payment, document, access reference, and support request.
2. Refresh the page.
3. Confirm saved data remains visible.
4. Confirm corrupted or missing localStorage data falls back to empty states instead of crashing.

## Known MVP Limitations

- localStorage default is not team-safe.
- Supabase migration is prepared but not fully active.
- Authentication and organization workspaces are not enabled yet.
- Automated email sending is not included.
- Real document upload is not included.
- Raw passwords must not be stored.
- Contact enrichment is lightweight homepage-only enrichment.
- Website, mobile app, booking, and social detection may be approximate.

## Recommended Next Release

- Complete Supabase migration for saved prospects, clients, lists, and workflow records.
- Add Supabase Auth and organization workspaces.
- Improve enrichment with safer, deeper provider-backed checks.
- Add advanced saved list management.
- Add email integration later, with explicit user control.
- Add analytics and reporting after storage/auth are production-ready.

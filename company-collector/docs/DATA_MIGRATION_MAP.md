# Client Finder Data Migration Map

Client Finder currently defaults to browser localStorage. This map documents each local data domain and the intended Supabase target before a full production migration.

## LocalStorage Domains

| Domain | localStorage key | Data shape summary | Supabase target | Required fields | Optional / JSON fields | Migration notes | Risk |
|---|---|---|---|---|---|---|---|
| Saved prospect IDs | `find-any-company.saved-companies` | Array of prospect IDs/dedupe IDs | `saved_prospects` | `organization_id`, `prospect_id` or metadata app ID, `status` | `metadata` for app IDs and dedupe keys | Migrate after organizations/users placeholder exists. Join with manual prospects and workflows. | Medium |
| Manual/search prospects | `find-any-company.manual-prospects` | Prospect objects from manual/test/live search cache | `prospects`, `saved_prospects` | `organization_id`, business name, business type | `metadata`, source payload, scoring fields | Use as source records for saved prospects. Do not duplicate by place ID/name/address. | Medium |
| Hidden/archive records | `find-any-company.hidden-prospects`; archive flags in workflows | Hidden dedupe keys and workflow archive flags | `hidden_prospects`, `saved_prospects.status` | `organization_id`, key/prospect reference, status | `metadata` for dedupe keys | Hidden search records and archived saved prospects are separate concepts. | Low |
| Prospect workflow | `find-any-company.prospect-workflows` | Object keyed by prospect ID containing stage, milestones, activities, notes, quote, outreach, enrichment | `prospect_activities`, `prospect_notes`, `process_milestones`, `follow_ups`, `outreach_templates`, `quotes`, `saved_prospects.metadata` | `organization_id`, saved prospect reference, timestamps | `metadata` for legacy workflow snapshot | Split after saved prospects are migrated. Keep a JSON snapshot during first migration for rollback. | High |
| Saved lists | `find-any-company.saved-lists` | Array of list records with prospect ID memberships | `search_presets` plus future list membership table or `saved_prospects.metadata` | `organization_id`, list name | `metadata.prospectIds`, tags, filters | Current schema does not have a dedicated list membership table. Add one before production if lists become core. | Medium |
| Saved searches | `find-any-company.saved-searches` | Array of saved search labels and filters | `search_history`, `search_presets` | `organization_id`, filters | `filters`, `metadata` | Presets should map to `search_presets`; one-off searches to `search_history`. | Low |
| Clients | `find-any-company.clients` | Array of full client objects including overview, project, onboarding, handover, documents, payments, access, support | `clients` plus child tables | `organization_id`, business name, status | `metadata` for legacy snapshot | Migrate base client rows first, then child records. | High |
| Client activities | Inside `clients[].activity` | Client timeline entries | `client_activities` | `organization_id`, `client_id`, activity type | `metadata` | Preserve timestamps and source labels. | Low |
| Onboarding checklist | Inside client objects | Checklist items/statuses | `client_onboarding_items` | `client_id`, label, checked/status | `metadata` | Migrate after client IDs are stable. | Medium |
| Project tracker | Inside client objects | Project tasks/status/blocked fields | `client_project_tasks` | `client_id`, title/status | `metadata` | Preserve project status on `clients.project_status`. | Medium |
| Handover checklist | Inside client objects | Handover items/status | `client_handover_items` | `client_id`, label, checked/status | `metadata` | Preserve handover status on client metadata if needed. | Medium |
| Documents | Inside client objects | Document references, links, notes | `client_documents` | `client_id`, title/category/status | `storage_reference`, `external_url`, `metadata` | No real upload yet. Store references only. | Low |
| Payments | Inside client objects | Payment summary and payment records | `client_payments` | `client_id`, amount/status/payment type | `metadata` | Avoid payment processing data. Store references/status only. | Medium |
| Access records | Inside client objects | Credential/access references | `client_access_records` | `client_id`, system name/status | `secure_storage_reference`, `metadata` | Do not migrate raw passwords. Only references and status. | High |
| Support requests | Inside client objects | Support plan and request records | `client_support_requests`, client metadata | `client_id`, title/status/priority | `metadata` | Support plan fields can live on client metadata until a support plan table exists. | Medium |
| Sender profile/settings | `find-any-company.sender-profile`; `CLIENT_FINDER_STORAGE_MODE` | Sender/outreach settings and storage mode override | `users`, `organization_members`, `outreach_templates`, app settings table later | user/org IDs | `metadata` | Do not migrate storage mode as business data. Sender profile belongs to user/org settings. | Low |
| Scan queue/cache | `find-any-company.scan-queue` | Local paused website scan queue | Do not migrate | n/a | n/a | Runtime-only cache. Clear before migration. | Low |

## Recommended Migration Order

1. Create organizations/users placeholder records.
2. Migrate saved prospects.
3. Migrate hidden/archive records.
4. Migrate prospect activities, notes, process milestones, follow-ups, outreach templates, and quote data.
5. Migrate saved lists and memberships.
6. Migrate clients.
7. Migrate client activities.
8. Migrate client onboarding, project, and handover records.
9. Migrate client documents, payments, access records, and support requests.
10. Migrate settings, sender profile, and reusable templates.

## Readiness Notes

- RLS must be enabled before multi-user production use.
- Keep a legacy JSON metadata snapshot during the first migration pass.
- Export a local backup before any migration attempt.
- Do not automatically migrate from the frontend without explicit user action.
- Do not store raw passwords or private API keys in migrated records.

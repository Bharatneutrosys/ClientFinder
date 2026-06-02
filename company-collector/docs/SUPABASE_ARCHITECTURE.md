# Supabase Architecture Plan

This document prepares Client Finder for a future Supabase migration while preserving the current localStorage MVP. No authentication, database sync, or production Supabase keys are required for the current version.

## Current Stage

Stage A is the current target:

- Keep localStorage as the source of truth.
- Keep search, saved prospects, workflow, quotes, client conversion, documents, payments, access records, support requests, and project tracking unchanged.
- Document the future database structure before adding Supabase code.

## Data Ownership Model

Client Finder should support multiple users and multiple organizations/workspaces.

- A user can belong to one or more organizations.
- Organizations own prospects, saved prospects, clients, search history, activities, quotes, payments, documents, access records, and workflow records.
- Most application records should include `organization_id`.
- User-authored records should include `created_by` or `user_id`.
- Users should only read or mutate records for organizations where they are members.
- Supabase Row Level Security must enforce organization membership before any multi-user release.

## Future Environment Variables

Frontend-safe:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`

Backend only later:

- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service role key in browser code or committed files.

## Core Tables

### organizations

Workspaces for teams or solo users.

- `id uuid primary key`
- `name text not null`
- `slug text unique`
- `status text default 'active'`
- `created_by uuid references users(id)`
- `settings jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

### users

Application profile for a Supabase auth user.

- `id uuid primary key`
- `auth_user_id uuid unique`
- `email text not null`
- `full_name text`
- `status text default 'active'`
- `default_organization_id uuid references organizations(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

### organization_members

Membership and roles for organization access.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `user_id uuid references users(id)`
- `role text` such as `owner`, `admin`, `member`, `viewer`
- `status text default 'active'`
- `invited_by uuid references users(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

## Prospecting Tables

### prospects

Raw and enriched business prospects discovered from search.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `external_source text`
- `external_id text`
- `dedupe_key text`
- `business_name text not null`
- `business_type text`
- `phone text`
- `email text`
- `website_url text`
- `google_profile_url text`
- `maps_url text`
- `address text`
- `city text`
- `state text`
- `country text default 'US'`
- `website_status text`
- `mobile_app_status text`
- `opportunity_score numeric`
- `opportunity_priority text`
- `score_reasons jsonb default '[]'`
- `contacts jsonb default '[]'`
- `source_data jsonb default '{}'`
- `created_by uuid references users(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

Recommended unique index: `(organization_id, dedupe_key)` where `dedupe_key` is not null.

### saved_prospects

Organization-specific saved workqueue entry for a prospect.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `prospect_id uuid references prospects(id)`
- `saved_by uuid references users(id)`
- `current_stage text`
- `status text default 'saved'`
- `priority text`
- `archived boolean default false`
- `archived_at timestamptz`
- `workflow_state jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

### hidden_prospects

Hidden or dismissed prospect records.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `prospect_id uuid references prospects(id)`
- `dedupe_key text`
- `hidden_by uuid references users(id)`
- `reason text`
- `created_at timestamptz`

### search_history

Past searches and collector runs.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `user_id uuid references users(id)`
- `query text`
- `industry text`
- `business_type text`
- `city text`
- `state text`
- `source text`
- `filters jsonb default '{}'`
- `result_count integer default 0`
- `created_at timestamptz`

### search_presets

Reusable search presets per organization.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `created_by uuid references users(id)`
- `name text not null`
- `industry text`
- `business_type text`
- `city text`
- `state text`
- `filters jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

## Workflow Tables

### prospect_activities

Timeline events for prospect workflow.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `prospect_id uuid references prospects(id)`
- `saved_prospect_id uuid references saved_prospects(id)`
- `created_by uuid references users(id)`
- `activity_type text`
- `method text`
- `outcome text`
- `message text`
- `notes text`
- `next_follow_up_at date`
- `metadata jsonb default '{}'`
- `created_at timestamptz`

### prospect_notes

Freeform prospect notes.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `prospect_id uuid references prospects(id)`
- `created_by uuid references users(id)`
- `note text not null`
- `created_at timestamptz`
- `updated_at timestamptz`

### process_milestones

Checklist/process state for saved prospect progression.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `saved_prospect_id uuid references saved_prospects(id)`
- `milestone_key text`
- `label text`
- `completed boolean default false`
- `completed_by uuid references users(id)`
- `completed_at timestamptz`
- `metadata jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

### follow_ups

Follow-up reminders across prospects and clients.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `prospect_id uuid references prospects(id)`
- `client_id uuid references clients(id)`
- `assigned_to uuid references users(id)`
- `created_by uuid references users(id)`
- `title text`
- `due_date date`
- `status text default 'open'`
- `source_type text`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

### outreach_templates

Saved or generated outreach templates.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `created_by uuid references users(id)`
- `name text`
- `template_type text`
- `tone text`
- `subject text`
- `body text`
- `is_default boolean default false`
- `metadata jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

### quotes

Quote preparation and status.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `prospect_id uuid references prospects(id)`
- `client_id uuid references clients(id)`
- `created_by uuid references users(id)`
- `quote_status text default 'Not Started'`
- `project_type text`
- `package_type text`
- `estimated_price numeric`
- `discount numeric default 0`
- `final_quote_amount numeric`
- `payment_terms text`
- `timeline_estimate text`
- `scope_notes text`
- `internal_notes text`
- `sent_at timestamptz`
- `accepted_at timestamptz`
- `rejected_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

## Client Tables

### clients

Converted client records.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `prospect_id uuid references prospects(id)`
- `created_by uuid references users(id)`
- `business_name text not null`
- `business_type text`
- `owner_or_manager_name text`
- `phone text`
- `email text`
- `address text`
- `city text`
- `state text`
- `website_url text`
- `google_profile_url text`
- `current_client_status text default 'Active Client'`
- `project_status text default 'Client Onboarding'`
- `project_type text`
- `package_type text`
- `start_date date`
- `target_launch_date date`
- `actual_launch_date date`
- `handover_status text default 'Not Started'`
- `support_status text default 'Not Started'`
- `maintenance_plan text default 'None'`
- `monthly_support_amount numeric`
- `support_start_date date`
- `support_end_date date`
- `renewal_reminder_date date`
- `notes text`
- `internal_notes text`
- `source_prospect_data jsonb default '{}'`
- `created_at timestamptz`
- `updated_at timestamptz`

### client_activities

Timeline events for client work.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `created_by uuid references users(id)`
- `source text`
- `message text`
- `metadata jsonb default '{}'`
- `created_at timestamptz`

### client_onboarding_items

Client onboarding checklist items.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `group_key text`
- `item_key text`
- `label text`
- `critical boolean default false`
- `checked boolean default false`
- `note text`
- `updated_by uuid references users(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

### client_project_tasks

Project delivery tracker tasks.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `phase_key text`
- `phase_title text`
- `task_key text`
- `label text`
- `major boolean default false`
- `suggested_status text`
- `checked boolean default false`
- `note text`
- `updated_by uuid references users(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

### client_handover_items

Launch and handover checklist items.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `group_key text`
- `item_key text`
- `label text`
- `critical boolean default false`
- `checked boolean default false`
- `note text`
- `updated_by uuid references users(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

### client_documents

Document references only. Do not store sensitive document content in this table.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `created_by uuid references users(id)`
- `category text`
- `title text not null`
- `status text`
- `storage_location text`
- `link_or_reference text`
- `storage_object_path text`
- `due_date date`
- `received_date date`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

### client_payments

Payment records and references. No payment processing or card details.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `created_by uuid references users(id)`
- `payment_date date`
- `amount numeric`
- `payment_method text`
- `payment_type text`
- `status text`
- `receipt_reference text`
- `storage_location text`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

### client_access_records

Access tracking references only. Do not store raw passwords.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `created_by uuid references users(id)`
- `category text`
- `platform_name text`
- `login_url text`
- `username_or_email text`
- `access_status text`
- `permission_level text`
- `secure_storage_reference text`
- `owner_contact text`
- `requested_date date`
- `received_date date`
- `last_verified_date date`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

### client_support_requests

Maintenance/support request tracking. This is not a full ticketing system yet.

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `client_id uuid references clients(id)`
- `created_by uuid references users(id)`
- `title text not null`
- `request_type text`
- `priority text default 'Normal'`
- `status text default 'New'`
- `requested_date date`
- `target_date date`
- `completed_date date`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

## JSON Field Guidance

Use structured columns for fields that need filtering, sorting, reporting, permissions, or joins. Use `jsonb` only for flexible data that changes often or is source-specific, such as raw collector payloads, score reasons, imported contacts, template metadata, and workflow metadata.

## Storage Service Interface Plan

Before adding Supabase code, introduce a storage abstraction that wraps the current localStorage functions. The first implementation can remain localStorage-backed.

Recommended interface:

- `storageService.getSavedProspects()`
- `storageService.saveProspect(prospect)`
- `storageService.updateProspect(id, updates)`
- `storageService.hideProspect(id, reason)`
- `storageService.getSearchHistory()`
- `storageService.saveSearchHistory(entry)`
- `storageService.getClients()`
- `storageService.saveClient(client)`
- `storageService.updateClient(id, updates)`
- `storageService.addActivity(targetType, targetId, activity)`
- `storageService.getQuotes(filters)`
- `storageService.saveQuote(quote)`
- `storageService.getSettings()`
- `storageService.saveSettings(settings)`

Later implementations:

- `localStorageStorageService`
- `supabaseStorageService`
- `hybridStorageService` for Supabase sync with localStorage backup

## Staged Migration Plan

### Stage A: Documentation Only

- Keep localStorage as current source of truth.
- Add this Supabase architecture document.
- Do not add auth or database writes.

### Stage B: Supabase Client Configuration

- Add Supabase client setup using placeholder env names.
- Keep localStorage behavior as fallback.
- Add feature flags so Supabase can be tested without affecting production localStorage users.

### Stage C: Sync Saved Prospects and Clients

- Sync `prospects`, `saved_prospects`, and `clients` to Supabase.
- Keep localStorage backup.
- Add import/export or one-time migration from localStorage.

### Stage D: Move Workflow Records

- Move activities, notes, milestones, follow-ups, quotes, onboarding, project tasks, handover, documents, payments, access records, and support requests to Supabase.
- Keep compatibility reads from localStorage during transition.

### Stage E: Auth and Organization Workspaces

- Add login/auth.
- Add organization selection and membership roles.
- Enable RLS policies before allowing multi-user production data.
- Move sensitive document references to Supabase Storage or another secure file system.

## Security Notes

- Do not store raw passwords in the app or database.
- Store password references only, such as 1Password, Google Password Manager, or secure client links.
- Sensitive documents should use Supabase Storage or another secure file system later.
- Enable RLS on all organization-owned tables before multi-user release.
- RLS should verify membership through `organization_members`.
- The service role key must never be exposed to frontend code.
- Payment tracking must not store card numbers, bank credentials, or payment processor secrets.
- File upload should not be added until storage permissions and document retention rules are defined.

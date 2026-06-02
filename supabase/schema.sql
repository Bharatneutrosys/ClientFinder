-- Client Finder Supabase schema preparation.
-- This schema is for future migration only. The current app still uses localStorage.
-- It is designed for a clean Supabase SQL Editor run and safe retries during
-- setup. It does not enable auth, RLS, file upload, or application writes yet.

create extension if not exists "pgcrypto";

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Platform -------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  full_name text,
  status text not null default 'active',
  default_organization_id uuid references organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table organizations drop constraint if exists organizations_created_by_fkey;
alter table organizations
  add constraint organizations_created_by_fkey
  foreign key (created_by) references users(id) on delete set null;

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  invited_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Prospecting ----------------------------------------------------------------

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  external_source text,
  external_id text,
  dedupe_key text,
  business_name text not null,
  business_type text,
  phone text,
  email text,
  website_url text,
  google_profile_url text,
  maps_url text,
  address text,
  city text,
  state text,
  country text not null default 'US',
  website_status text,
  mobile_app_status text,
  review_count integer,
  rating numeric,
  opportunity_score numeric,
  opportunity_priority text,
  score_reasons jsonb not null default '[]'::jsonb,
  contacts jsonb not null default '[]'::jsonb,
  source_data jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prospects_org_dedupe_key_idx
  on prospects (organization_id, dedupe_key);

create table if not exists saved_prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid not null references prospects(id) on delete cascade,
  saved_by uuid references users(id) on delete set null,
  current_stage text,
  status text not null default 'saved',
  priority text,
  archived boolean not null default false,
  archived_at timestamptz,
  workflow_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, prospect_id)
);

create table if not exists hidden_prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  dedupe_key text,
  hidden_by uuid references users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  query text,
  industry text,
  business_type text,
  city text,
  state text,
  source text,
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists search_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  name text not null,
  industry text,
  business_type text,
  city text,
  state text,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workflow -------------------------------------------------------------------

create table if not exists prospect_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  saved_prospect_id uuid references saved_prospects(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  activity_type text,
  method text,
  outcome text,
  message text,
  notes text,
  next_follow_up_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists prospect_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid not null references prospects(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists process_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  saved_prospect_id uuid not null references saved_prospects(id) on delete cascade,
  milestone_key text not null,
  label text,
  completed boolean not null default false,
  completed_by uuid references users(id) on delete set null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (saved_prospect_id, milestone_key)
);

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  client_id uuid,
  assigned_to uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  title text,
  due_date date,
  status text not null default 'open',
  source_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  name text,
  template_type text,
  tone text,
  subject text,
  body text,
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  client_id uuid,
  created_by uuid references users(id) on delete set null,
  quote_status text not null default 'Not Started',
  project_type text,
  package_type text,
  estimated_price numeric,
  discount numeric not null default 0,
  final_quote_amount numeric,
  payment_terms text,
  timeline_estimate text,
  scope_notes text,
  internal_notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clients --------------------------------------------------------------------

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  business_name text not null,
  business_type text,
  owner_or_manager_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  website_url text,
  google_profile_url text,
  current_client_status text not null default 'Active Client',
  project_status text not null default 'Client Onboarding',
  project_type text,
  package_type text,
  start_date date,
  target_launch_date date,
  actual_launch_date date,
  handover_status text not null default 'Not Started',
  support_status text not null default 'Not Started',
  maintenance_plan text not null default 'None',
  monthly_support_amount numeric,
  support_start_date date,
  support_end_date date,
  renewal_reminder_date date,
  notes text,
  internal_notes text,
  source_prospect_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table follow_ups drop constraint if exists follow_ups_client_id_fkey;
alter table follow_ups
  add constraint follow_ups_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

alter table quotes drop constraint if exists quotes_client_id_fkey;
alter table quotes
  add constraint quotes_client_id_fkey
  foreign key (client_id) references clients(id) on delete set null;

create table if not exists client_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  source text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists client_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  group_key text,
  item_key text not null,
  label text,
  critical boolean not null default false,
  checked boolean not null default false,
  note text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, item_key)
);

create table if not exists client_project_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  phase_key text,
  phase_title text,
  task_key text not null,
  label text,
  major boolean not null default false,
  suggested_status text,
  checked boolean not null default false,
  note text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, phase_key, task_key)
);

create table if not exists client_handover_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  group_key text,
  item_key text not null,
  label text,
  critical boolean not null default false,
  checked boolean not null default false,
  note text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, group_key, item_key)
);

create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  category text,
  title text not null,
  status text,
  storage_location text,
  link_or_reference text,
  storage_object_path text,
  due_date date,
  received_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  payment_date date,
  amount numeric,
  payment_method text,
  payment_type text,
  status text,
  receipt_reference text,
  storage_location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_access_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  category text,
  platform_name text,
  login_url text,
  username_or_email text,
  access_status text,
  permission_level text,
  secure_storage_reference text,
  owner_contact text,
  requested_date date,
  received_date date,
  last_verified_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  title text not null,
  request_type text,
  priority text not null default 'Normal',
  status text not null default 'New',
  requested_date date,
  target_date date,
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes --------------------------------------------------------------------

create index if not exists users_default_organization_idx on users (default_organization_id);
create index if not exists organization_members_org_idx on organization_members (organization_id);
create index if not exists organization_members_user_idx on organization_members (user_id);

create index if not exists prospects_org_idx on prospects (organization_id);
create index if not exists prospects_org_status_created_idx on prospects (organization_id, website_status, created_at desc);
create index if not exists prospects_business_type_idx on prospects (business_type);
create index if not exists prospects_city_state_idx on prospects (city, state);
create index if not exists prospects_website_status_idx on prospects (website_status);
create index if not exists prospects_created_at_idx on prospects (created_at desc);

create index if not exists saved_prospects_org_status_idx on saved_prospects (organization_id, status);
create index if not exists saved_prospects_org_stage_idx on saved_prospects (organization_id, current_stage);
create index if not exists saved_prospects_created_at_idx on saved_prospects (created_at desc);
create index if not exists hidden_prospects_org_idx on hidden_prospects (organization_id);
create index if not exists search_history_org_created_idx on search_history (organization_id, created_at desc);
create index if not exists search_presets_org_idx on search_presets (organization_id);

create index if not exists prospect_activities_org_created_idx on prospect_activities (organization_id, created_at desc);
create index if not exists prospect_activities_prospect_idx on prospect_activities (prospect_id);
create index if not exists prospect_notes_prospect_idx on prospect_notes (prospect_id);
create index if not exists process_milestones_saved_idx on process_milestones (saved_prospect_id);
create index if not exists follow_ups_org_status_due_idx on follow_ups (organization_id, status, due_date);
create index if not exists outreach_templates_org_idx on outreach_templates (organization_id);
create index if not exists quotes_org_status_idx on quotes (organization_id, quote_status);

create index if not exists clients_org_idx on clients (organization_id);
create index if not exists clients_org_status_idx on clients (organization_id, project_status);
create index if not exists clients_business_type_idx on clients (business_type);
create index if not exists clients_city_state_idx on clients (city, state);
create index if not exists clients_created_at_idx on clients (created_at desc);
create index if not exists client_activities_client_created_idx on client_activities (client_id, created_at desc);
create index if not exists client_documents_client_status_idx on client_documents (client_id, status);
create index if not exists client_payments_client_status_idx on client_payments (client_id, status);
create index if not exists client_access_records_client_status_idx on client_access_records (client_id, access_status);
create index if not exists client_support_requests_client_status_idx on client_support_requests (client_id, status);
create index if not exists client_support_requests_target_date_idx on client_support_requests (organization_id, target_date);

-- updated_at triggers ---------------------------------------------------------

drop trigger if exists organizations_updated_at on organizations;
create trigger organizations_updated_at before update on organizations
  for each row execute function update_updated_at_column();
drop trigger if exists users_updated_at on users;
create trigger users_updated_at before update on users
  for each row execute function update_updated_at_column();
drop trigger if exists organization_members_updated_at on organization_members;
create trigger organization_members_updated_at before update on organization_members
  for each row execute function update_updated_at_column();
drop trigger if exists prospects_updated_at on prospects;
create trigger prospects_updated_at before update on prospects
  for each row execute function update_updated_at_column();
drop trigger if exists saved_prospects_updated_at on saved_prospects;
create trigger saved_prospects_updated_at before update on saved_prospects
  for each row execute function update_updated_at_column();
drop trigger if exists search_presets_updated_at on search_presets;
create trigger search_presets_updated_at before update on search_presets
  for each row execute function update_updated_at_column();
drop trigger if exists prospect_notes_updated_at on prospect_notes;
create trigger prospect_notes_updated_at before update on prospect_notes
  for each row execute function update_updated_at_column();
drop trigger if exists process_milestones_updated_at on process_milestones;
create trigger process_milestones_updated_at before update on process_milestones
  for each row execute function update_updated_at_column();
drop trigger if exists follow_ups_updated_at on follow_ups;
create trigger follow_ups_updated_at before update on follow_ups
  for each row execute function update_updated_at_column();
drop trigger if exists outreach_templates_updated_at on outreach_templates;
create trigger outreach_templates_updated_at before update on outreach_templates
  for each row execute function update_updated_at_column();
drop trigger if exists quotes_updated_at on quotes;
create trigger quotes_updated_at before update on quotes
  for each row execute function update_updated_at_column();
drop trigger if exists clients_updated_at on clients;
create trigger clients_updated_at before update on clients
  for each row execute function update_updated_at_column();
drop trigger if exists client_onboarding_items_updated_at on client_onboarding_items;
create trigger client_onboarding_items_updated_at before update on client_onboarding_items
  for each row execute function update_updated_at_column();
drop trigger if exists client_project_tasks_updated_at on client_project_tasks;
create trigger client_project_tasks_updated_at before update on client_project_tasks
  for each row execute function update_updated_at_column();
drop trigger if exists client_handover_items_updated_at on client_handover_items;
create trigger client_handover_items_updated_at before update on client_handover_items
  for each row execute function update_updated_at_column();
drop trigger if exists client_documents_updated_at on client_documents;
create trigger client_documents_updated_at before update on client_documents
  for each row execute function update_updated_at_column();
drop trigger if exists client_payments_updated_at on client_payments;
create trigger client_payments_updated_at before update on client_payments
  for each row execute function update_updated_at_column();
drop trigger if exists client_access_records_updated_at on client_access_records;
create trigger client_access_records_updated_at before update on client_access_records
  for each row execute function update_updated_at_column();
drop trigger if exists client_support_requests_updated_at on client_support_requests;
create trigger client_support_requests_updated_at before update on client_support_requests
  for each row execute function update_updated_at_column();

-- RLS preparation -------------------------------------------------------------
-- RLS must be enabled and tested before any multi-user production release.
-- The app has not added auth yet, so policies are intentionally left as
-- comments. Once auth is wired, enable RLS for each organization-owned table
-- and restrict access through organization_members.
--
-- Example pattern:
-- alter table prospects enable row level security;
-- create policy "organization members can read prospects"
--   on prospects for select
--   using (
--     exists (
--       select 1
--       from organization_members om
--       join users u on u.id = om.user_id
--       where om.organization_id = prospects.organization_id
--         and u.auth_user_id = auth.uid()
--         and om.status = 'active'
--     )
--   );

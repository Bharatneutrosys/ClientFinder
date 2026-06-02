-- Demo seed data for Client Finder Supabase preparation.
-- This contains no private data and is optional.

insert into organizations (id, name, slug, status, settings)
values (
  '00000000-0000-4000-8000-000000000001',
  'Demo Workspace',
  'demo-workspace',
  'active',
  '{"source":"seed"}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    status = excluded.status,
    settings = excluded.settings;

insert into users (id, email, full_name, status, default_organization_id)
values (
  '00000000-0000-4000-8000-000000000002',
  'demo@example.com',
  'Demo User',
  'active',
  '00000000-0000-4000-8000-000000000001'
)
on conflict (email) do update
set full_name = excluded.full_name,
    status = excluded.status,
    default_organization_id = excluded.default_organization_id;

update organizations
set created_by = '00000000-0000-4000-8000-000000000002'
where id = '00000000-0000-4000-8000-000000000001';

insert into organization_members (organization_id, user_id, role, status)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'owner',
  'active'
)
on conflict (organization_id, user_id) do update
set role = excluded.role,
    status = excluded.status;

insert into search_presets (organization_id, created_by, name, industry, business_type, city, state, filters)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Salon - Farmers Branch - No Website',
    'Salon & Beauty',
    'Salon',
    'Farmers Branch',
    'TX',
    '{"websiteCondition":"Has Website = No"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Cleaning Company - Los Angeles - Booking Missing',
    'Home Services',
    'Cleaning',
    'Los Angeles',
    'CA',
    '{"mobileAppCondition":"Booking System Missing"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'IT Staffing - Maine - Any Website',
    'Local Services',
    'IT Staffing',
    null,
    'ME',
    '{"websiteCondition":"Any Website Condition"}'::jsonb
  );

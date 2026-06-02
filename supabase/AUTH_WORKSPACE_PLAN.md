# Authentication and Workspace Plan

This plan defines the future multi-user model for Client Finder. It is planning only. The current app still defaults to localStorage, does not require login, and should remain usable as a single-user MVP.

## User Model

Future authentication should use Supabase Auth.

- A user can belong to one or more organizations.
- A user can have a different role in each organization.
- A user profile row in `users` maps to a Supabase Auth identity through `auth_user_id`.
- Email/password and magic link login can be supported later.
- Social login can be added later if it is useful for the target users.

Recommended user fields:

- `id`
- `auth_user_id`
- `email`
- `full_name`
- `default_organization_id`
- `status`
- `created_at`
- `updated_at`

## Organization and Workspace Model

An organization is the main data boundary. It represents a company, solo workspace, or team.

Organization-owned records include:

- Prospects
- Saved prospects
- Hidden/archive records
- Search history and search presets
- Prospect activities and notes
- Process milestones and follow-ups
- Outreach templates
- Quotes
- Clients
- Client activities
- Client onboarding/project/handover records
- Client documents
- Client payments
- Client access records
- Client support requests

Each organization-owned table should include `organization_id`. Each user should only see records for organizations where they have an active membership.

## Roles

Recommended roles:

- `Owner`: full access, billing, settings, user management, ownership transfer.
- `Admin`: manage workspace data and users except ownership and billing authority.
- `Manager`: manage prospects, clients, projects, outreach, quotes, and follow-ups.
- `Member`: work on assigned/saved prospects and clients.
- `Viewer`: read-only access.

## Permission Matrix

| Capability | Owner | Admin | Manager | Member | Viewer |
| --- | --- | --- | --- | --- | --- |
| Search prospects | Yes | Yes | Yes | Yes | Yes |
| Save prospects | Yes | Yes | Yes | Yes | No |
| Hide/archive prospects | Yes | Yes | Yes | Limited | No |
| Edit saved prospects | Yes | Yes | Yes | Limited | No |
| Send/copy outreach | Yes | Yes | Yes | Yes | No |
| Convert prospect to client | Yes | Yes | Yes | No | No |
| Edit client profile | Yes | Yes | Yes | Limited | No |
| Edit payments | Yes | Yes | Limited | No | No |
| Edit credentials/access references | Yes | Yes | Limited | No | No |
| Manage users | Yes | Yes | No | No | No |
| Manage organization settings | Yes | Limited | No | No | No |
| Delete/archive records | Yes | Yes | Limited | No | No |

`Limited` means the role may update records they own or are assigned to, depending on future assignment rules.

## RLS Policy Plan

Before any real multi-user release:

- Enable RLS on every organization-owned table.
- Join authenticated users through `users.auth_user_id = auth.uid()`.
- Check active membership in `organization_members`.
- Restrict reads to records where the user is an active member of `organization_id`.
- Restrict writes by role.
- Add stricter rules for sensitive tables such as `client_payments` and `client_access_records`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in backend/admin jobs. Never expose it to frontend code.

Example read policy shape:

```sql
exists (
  select 1
  from organization_members om
  join users u on u.id = om.user_id
  where om.organization_id = target_table.organization_id
    and u.auth_user_id = auth.uid()
    and om.status = 'active'
)
```

Role checks can extend this pattern:

```sql
and om.role in ('owner', 'admin', 'manager')
```

## Placeholder Workspace Settings

Until auth is implemented, the app can use local/mock workspace settings only:

```json
{
  "currentOrganizationId": "local-workspace",
  "currentUserId": "local-user",
  "currentRole": "Owner",
  "storageMode": "localStorage"
}
```

These values are informational only and must not be treated as security controls.

## Migration Stages

### Stage A: Local Single-User Mode

- Current mode.
- localStorage is the default source of truth.
- No login required.

### Stage B: Supabase Storage With Default Organization

- Use a default organization id for testing.
- Saved prospects and clients can be tested behind feature flags.
- localStorage remains fallback.

### Stage C: Supabase Auth Enabled

- Add login.
- Link Supabase Auth users to `users`.
- Do not enforce login until migration is tested.

### Stage D: Organization Membership and RLS

- Add organization switcher.
- Enable and test RLS on organization-owned tables.
- Enforce role-based write permissions.

### Stage E: Multi-User Collaboration and Roles

- Add assigned owners, team views, and activity attribution.
- Add invitations and member management.

### Stage F: Billing or Subscription

- Add only if needed.
- Keep billing separate from workspace authorization logic.

## Security Notes

- Do not expose the service role key in frontend code.
- Do not store raw passwords.
- Use RLS before real multi-user release.
- Payments and access records need stricter role controls.
- localStorage mode is not suitable for real team production data.
- Access records should store only references to secure password managers or client-provided secure links.

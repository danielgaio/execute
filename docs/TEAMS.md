# Team & Organization Management

Execute provides comprehensive multi-user collaboration through organizations and teams. The system supports both traditional UI workflows and agent-assisted management for seamless team operations.

## Architecture

### Three-Level Hierarchy

```
Organization (Tenant)
  └─ Teams (Optional groupings)
       └─ Members (Users with roles)
```

- **Organization**: Top-level tenant boundary (e.g., "Acme Corp")
- **Teams**: Optional groupings within an org (e.g., "Engineering", "Sales")
- **Members**: Users with assigned roles at org and/or team level

### Role Hierarchy

| Role        | Org-Level Permissions                                              | Team-Level Permissions                 |
| ----------- | ------------------------------------------------------------------ | -------------------------------------- |
| **Owner**   | Full org control, billing, create/delete teams, manage all members | Access to all teams                    |
| **Manager** | Create teams, invite members, view org analytics                   | Manage assigned teams, facilitate WPRs |
| **Member**  | View own data, create personal cycles                              | Execute tactics, participate in WPRs   |
| **Viewer**  | Read-only access to dashboards                                     | Read-only access to team data          |

## Core Workflows

### 1. Organization Creation

**Traditional UI:**

```typescript
// First-time user sees org creation form
POST /dashboard/organizations/actions.ts
  → createOrganization(formData)
```

**Agent-Assisted:**

```
User: "Create an organization called Acme Corp"
Agent: [Uses existing org creation logic]
      "Organization 'Acme Corp' created! You are now the owner."
```

### 2. Team Creation

**Traditional UI:**

- Navigate to `/dashboard/teams`
- Click "Create Team"
- Fill form: name, description
- Creator automatically becomes team manager

**Agent-Assisted:**

```
User: "Create a team called Engineering for technical projects"
Agent: create_team(org_id, "Engineering", "Technical projects")
      "Team 'Engineering' created! You are now a team manager."
```

### 3. Member Invitation

**Flow:**

1. Owner/Manager invites user by email
2. System generates secure token (expires in 7 days)
3. Email sent with invitation link
4. User clicks link → creates account (if needed) → accepts invitation
5. User added to org with specified role + optional teams

**Traditional UI:**

- Settings → Members → "Invite Member"
- Enter: email, role, optional teams
- System sends email automatically

**Agent-Assisted:**

```
User: "Invite john@example.com as a member to the Engineering team"
Agent: invite_member(org_id, "john@example.com", "member", ["team-id"])
      "Invitation sent to john@example.com! They have 7 days to accept."
```

**Email Template:**

- Clear call-to-action button
- Shows inviter name, org name, role
- Expiry warning (7 days)
- Secure, single-use token

### 4. Role Management

**Constraints:**

- Cannot change own role (prevents lock-out)
- Cannot demote last owner in org
- Cannot demote last manager in team
- Only owners can change org-level roles
- Owners/managers/team managers can change team roles

**Traditional UI:**

- Team page → Member actions menu → "Change Role"
- Settings → Org members → Role dropdown

**Agent-Assisted:**

```
User: "Make Sarah a manager of the Engineering team"
Agent: update_team_member_role(team_id, sarah_user_id, "manager")
      "Role updated to manager successfully."

User: "Promote Alex to org owner"
Agent: update_org_member_role(org_id, alex_user_id, "owner")
      "Org role updated to owner successfully."
```

### 5. Member Removal

**Team Removal:**

- Removes user from team (not org)
- Cannot remove last manager

**Org Removal:** (Future)

- Removes user from org entirely
- Cascades to all teams

## Agent Tools Reference

### Query Tools

```typescript
// List all teams
list_teams(org_id: uuid)
→ Returns: team_id, name, description, created_at

// List team members
list_team_members(team_id: uuid)
→ Returns: user_id, name, email, role, added_at

// List org members
list_org_members(org_id: uuid)
→ Returns: user_id, name, email, role, created_at

// List pending invitations
list_pending_invitations(org_id: uuid)
→ Returns: invitation_id, email, role, invited_by, expires_at
```

### Action Tools (Require Confirmation)

```typescript
// Create team
create_team(org_id: uuid, name: string, description?: string)
→ Requires: owner or manager role

// Invite member
invite_member(org_id: uuid, email: string, role: enum, team_ids?: uuid[])
→ Requires: owner or manager role
→ Sends email automatically

// Add existing member to team
add_team_member(team_id: uuid, user_id: uuid, role: enum)
→ Requires: owner, manager, or team manager

// Remove member from team
remove_team_member(team_id: uuid, user_id: uuid)
→ Requires: owner, manager, or team manager
→ Cannot remove last manager

// Update team member role
update_team_member_role(team_id: uuid, user_id: uuid, new_role: enum)
→ Requires: owner or org manager

// Update org member role
update_org_member_role(org_id: uuid, user_id: uuid, new_role: enum)
→ Requires: owner only
→ Cannot change own role
→ Cannot demote last owner

// Revoke invitation
revoke_invitation(invitation_id: uuid)
→ Requires: owner or manager
```

## Security & Multi-Tenancy

### Row-Level Security (RLS)

All tables enforce strict RLS policies:

```sql
-- Teams visible only to org members
create policy "org_members_can_view_teams" on teams
  for select using (
    exists (
      select 1 from org_members m
      where m.org_id = teams.org_id
        and m.user_id = auth.uid()
    )
  );

-- Invitations visible only to org managers
create policy "org_managers_can_view_invitations" on invitations
  for select using (
    exists (
      select 1 from org_members m
      where m.org_id = invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'manager')
    )
  );
```

### Invitation Security

- **Cryptographically Secure Tokens**: 32 bytes base64url-encoded
- **Single-Use**: Token invalidated after acceptance
- **Expiry**: 7 days (configurable)
- **Email Verification**: User email must match invitation
- **No Cross-Tenant Leakage**: RLS enforced on all operations

### Audit Trail

All team operations are logged:

- Team creation/modification
- Member additions/removals
- Role changes
- Invitation sends/accepts/revocations

```typescript
await auditLog.create({
  actor_user_id: session.user.id,
  action: "team_member_added",
  entity_type: "team",
  entity_id: team_id,
  before: null,
  after: { user_id, role },
});
```

## Database Schema

### Core Tables

```sql
-- Organizations (tenants)
organizations (
  id uuid primary key,
  name text not null,
  created_by uuid references profiles,
  created_at timestamptz
)

-- Org memberships
org_members (
  id uuid primary key,
  org_id uuid references organizations,
  user_id uuid references profiles,
  role text check (role in ('owner', 'manager', 'member', 'viewer')),
  unique(org_id, user_id)
)

-- Teams
teams (
  id uuid primary key,
  org_id uuid references organizations,
  name text not null,
  description text,
  created_by uuid references profiles,
  created_at timestamptz
)

-- Team memberships
team_members (
  id uuid primary key,
  team_id uuid references teams,
  user_id uuid references profiles,
  role text check (role in ('manager', 'member', 'viewer')),
  added_by uuid references profiles,
  unique(team_id, user_id)
)

-- Invitations
invitations (
  id uuid primary key,
  org_id uuid references organizations,
  email text not null,
  role text not null,
  team_ids uuid[],
  token text unique not null,
  invited_by uuid references profiles,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz
)
```

## Best Practices

### For Application Developers

1. **Always Use Domain Services**: Never directly manipulate team/member tables
2. **Respect Confirmation Requirements**: All agent actions require user confirmation
3. **Handle Errors Gracefully**: Provide clear, actionable error messages
4. **Audit Everything**: Use `logAgentAction` for all write operations
5. **Test RLS Policies**: Ensure no cross-tenant data leakage

### For End Users

1. **Use Agent for Bulk Operations**: "Add all Engineering members to Backend team"
2. **Verify Email Addresses**: Invitations go to exact email address provided
3. **Set Expiry Reminders**: Invitations expire in 7 days
4. **Maintain One Owner Minimum**: System prevents accidental lock-out

## Future Enhancements

- **SCIM Provisioning**: Automatic user sync from IdP
- **Team Hierarchies**: Nested teams (parent/child relationships)
- **Custom Roles**: Fine-grained permission definitions
- **Bulk Operations**: Import/export members via CSV
- **Team Templates**: Pre-configured team structures
- **Activity Feed**: Real-time team activity notifications

---

**Last Updated:** December 24, 2025  
**Version:** 1.0

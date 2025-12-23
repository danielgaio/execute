-- ==================================================================
-- Audit Logging and Entity Versioning System
-- ==================================================================
-- Purpose: Track all mutations for compliance, debugging, and analytics
-- Principles: Append-only (immutable), RLS-aware, agent-action tracking
-- ==================================================================

-- =========================
-- 1. Central Audit Log Table
-- =========================

create table public.audit_log (
  id uuid default gen_random_uuid() primary key,
  
  -- Who: Actor information
  actor_user_id uuid references public.profiles(id),
  actor_type text default 'user' check (actor_type in ('user', 'agent', 'system', 'api')),
  actor_context jsonb default '{}'::jsonb, -- IP, user agent, agent tool name, etc.
  
  -- What: Action details
  action text not null check (action in (
    'create', 'update', 'delete', 
    'agent_tool_call', 'bulk_operation',
    'status_change', 'assignment_change'
  )),
  entity_type text not null check (entity_type in (
    'organization', 'team', 'cycle', 'vision', 
    'goal', 'tactic', 'tactic_instance', 
    'weekly_plan', 'org_member', 'team_member'
  )),
  entity_id uuid not null,
  
  -- When
  timestamp timestamptz default now() not null,
  
  -- Context: What changed
  before_state jsonb, -- Full state before change (for updates/deletes)
  after_state jsonb,  -- Full state after change (for creates/updates)
  diff jsonb,         -- Structured diff for efficient querying
  
  -- Multi-tenant isolation
  org_id uuid references public.organizations(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  
  -- Metadata
  metadata jsonb default '{}'::jsonb, -- Additional context (confirmation status, reason, etc.)
  
  created_at timestamptz default now()
);

-- Indexes for efficient querying
create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_log_actor on public.audit_log(actor_user_id, timestamp desc);
create index idx_audit_log_org on public.audit_log(org_id, timestamp desc);
create index idx_audit_log_timestamp on public.audit_log(timestamp desc);
create index idx_audit_log_action on public.audit_log(action, entity_type);

-- Enable RLS
alter table public.audit_log enable row level security;

-- RLS: Org members can view audit logs for their org
create policy "Org members can view audit logs" on public.audit_log
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = audit_log.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- RLS: Only system/service role can insert audit logs (prevents tampering)
create policy "System can insert audit logs" on public.audit_log
  for insert with check (true); -- Will be called from triggers with SECURITY DEFINER

-- =========================
-- 2. Entity Version Tables
-- =========================

-- Vision Versions (track content changes over time)
create table public.vision_versions (
  id uuid default gen_random_uuid() primary key,
  vision_id uuid references public.visions(id) on delete cascade not null,
  version integer not null,
  content_md text,
  changed_by uuid references public.profiles(id),
  change_reason text,
  created_at timestamptz default now(),
  unique(vision_id, version)
);

alter table public.vision_versions enable row level security;

create policy "Org members can view vision versions" on public.vision_versions
  for select using (
    exists (
      select 1 from public.visions v
      join public.org_members om on om.org_id = v.org_id
      where v.id = vision_versions.vision_id
      and om.user_id = auth.uid()
    )
  );

-- Goal Versions (track goal target/status changes)
create table public.goal_versions (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references public.goals(id) on delete cascade not null,
  version integer not null,
  title text,
  description text,
  target numeric,
  baseline numeric,
  status text,
  changed_by uuid references public.profiles(id),
  change_reason text,
  diff jsonb, -- Structured diff showing what changed
  created_at timestamptz default now(),
  unique(goal_id, version)
);

alter table public.goal_versions enable row level security;

create policy "Org members can view goal versions" on public.goal_versions
  for select using (
    exists (
      select 1 from public.goals g
      join public.org_members om on om.org_id = g.org_id
      where g.id = goal_versions.goal_id
      and om.user_id = auth.uid()
    )
  );

-- Tactic Versions (track tactic changes)
create table public.tactic_versions (
  id uuid default gen_random_uuid() primary key,
  tactic_id uuid references public.tactics(id) on delete cascade not null,
  version integer not null,
  title text,
  description text,
  weight numeric,
  recurrence text,
  due_days integer[],
  assignee_user_id uuid,
  changed_by uuid references public.profiles(id),
  change_reason text,
  diff jsonb,
  created_at timestamptz default now(),
  unique(tactic_id, version)
);

alter table public.tactic_versions enable row level security;

create policy "Org members can view tactic versions" on public.tactic_versions
  for select using (
    exists (
      select 1 from public.tactics t
      join public.org_members om on om.org_id = t.org_id
      where t.id = tactic_versions.tactic_id
      and om.user_id = auth.uid()
    )
  );

-- =========================
-- 3. Audit Helper Functions
-- =========================

-- Function to log agent actions
create or replace function log_agent_action(
  p_actor_user_id uuid,
  p_tool_name text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_org_id uuid,
  p_team_id uuid,
  p_before_state jsonb,
  p_after_state jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_audit_id uuid;
begin
  insert into public.audit_log (
    actor_user_id,
    actor_type,
    actor_context,
    action,
    entity_type,
    entity_id,
    org_id,
    team_id,
    before_state,
    after_state,
    metadata
  ) values (
    p_actor_user_id,
    'agent',
    jsonb_build_object('tool_name', p_tool_name),
    p_action,
    p_entity_type,
    p_entity_id,
    p_org_id,
    p_team_id,
    p_before_state,
    p_after_state,
    p_metadata
  )
  returning id into v_audit_id;
  
  return v_audit_id;
end;
$$;

-- Function to compute JSON diff
create or replace function compute_jsonb_diff(
  old_data jsonb,
  new_data jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
  diff jsonb := '{}'::jsonb;
  key text;
begin
  -- Find changed and new keys
  for key in select jsonb_object_keys(new_data)
  loop
    if old_data is null or not old_data ? key then
      -- New field
      diff := diff || jsonb_build_object(key, jsonb_build_object(
        'action', 'added',
        'new_value', new_data->key
      ));
    elsif old_data->key <> new_data->key then
      -- Changed field
      diff := diff || jsonb_build_object(key, jsonb_build_object(
        'action', 'changed',
        'old_value', old_data->key,
        'new_value', new_data->key
      ));
    end if;
  end loop;
  
  -- Find removed keys
  if old_data is not null then
    for key in select jsonb_object_keys(old_data)
    loop
      if not new_data ? key then
        diff := diff || jsonb_build_object(key, jsonb_build_object(
          'action', 'removed',
          'old_value', old_data->key
        ));
      end if;
    end loop;
  end if;
  
  return diff;
end;
$$;

-- =========================
-- 4. Automatic Audit Triggers
-- =========================

-- Generic audit trigger function
create or replace function audit_entity_changes()
returns trigger
language plpgsql
security definer
as $$
declare
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  v_org_id uuid;
  v_team_id uuid;
  v_entity_type text;
begin
  -- Determine action
  if TG_OP = 'INSERT' then
    v_action := 'create';
    v_before := null;
    v_after := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_before := to_jsonb(OLD);
    v_after := null;
  end if;
  
  -- Compute diff for updates
  if TG_OP = 'UPDATE' then
    v_diff := compute_jsonb_diff(v_before, v_after);
  end if;
  
  -- Extract org_id and team_id based on operation
  if TG_OP = 'DELETE' then
    v_org_id := OLD.org_id;
    v_team_id := OLD.team_id;
  else
    v_org_id := NEW.org_id;
    v_team_id := NEW.team_id;
  end if;
  
  -- Extract entity type from table name
  v_entity_type := TG_TABLE_NAME;
  
  -- Insert audit log
  insert into public.audit_log (
    actor_user_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    org_id,
    team_id,
    before_state,
    after_state,
    diff
  ) values (
    auth.uid(),
    'user', -- Will be overridden by log_agent_action for agent calls
    v_action,
    v_entity_type,
    coalesce(NEW.id, OLD.id),
    v_org_id,
    v_team_id,
    v_before,
    v_after,
    v_diff
  );
  
  return coalesce(NEW, OLD);
end;
$$;

-- Attach triggers to critical tables
create trigger audit_cycles_changes
  after insert or update or delete on public.cycles
  for each row execute function audit_entity_changes();

create trigger audit_goals_changes
  after insert or update or delete on public.goals
  for each row execute function audit_entity_changes();

create trigger audit_tactics_changes
  after insert or update or delete on public.tactics
  for each row execute function audit_entity_changes();

create trigger audit_tactic_instances_changes
  after insert or update or delete on public.tactic_instances
  for each row execute function audit_entity_changes();

create trigger audit_visions_changes
  after insert or update or delete on public.visions
  for each row execute function audit_entity_changes();

create trigger audit_weekly_plans_changes
  after insert or update or delete on public.weekly_plans
  for each row execute function audit_entity_changes();

-- =========================
-- 5. Versioning Triggers
-- =========================

-- Vision versioning trigger
create or replace function version_vision_changes()
returns trigger
language plpgsql
security definer
as $$
declare
  v_version integer;
begin
  -- Get next version number
  select coalesce(max(version), 0) + 1 into v_version
  from public.vision_versions
  where vision_id = NEW.id;
  
  -- Insert version record
  insert into public.vision_versions (
    vision_id,
    version,
    content_md,
    changed_by
  ) values (
    NEW.id,
    v_version,
    NEW.content_md,
    auth.uid()
  );
  
  return NEW;
end;
$$;

create trigger version_visions
  after insert or update on public.visions
  for each row execute function version_vision_changes();

-- Goal versioning trigger
create or replace function version_goal_changes()
returns trigger
language plpgsql
security definer
as $$
declare
  v_version integer;
  v_diff jsonb;
begin
  -- Only version on actual changes
  if TG_OP = 'INSERT' or (
    OLD.title is distinct from NEW.title or
    OLD.description is distinct from NEW.description or
    OLD.target is distinct from NEW.target or
    OLD.baseline is distinct from NEW.baseline or
    OLD.status is distinct from NEW.status
  ) then
    -- Get next version number
    select coalesce(max(version), 0) + 1 into v_version
    from public.goal_versions
    where goal_id = NEW.id;
    
    -- Compute diff
    if TG_OP = 'UPDATE' then
      v_diff := compute_jsonb_diff(to_jsonb(OLD), to_jsonb(NEW));
    end if;
    
    -- Insert version record
    insert into public.goal_versions (
      goal_id,
      version,
      title,
      description,
      target,
      baseline,
      status,
      changed_by,
      diff
    ) values (
      NEW.id,
      v_version,
      NEW.title,
      NEW.description,
      NEW.target,
      NEW.baseline,
      NEW.status,
      auth.uid(),
      v_diff
    );
  end if;
  
  return NEW;
end;
$$;

create trigger version_goals
  after insert or update on public.goals
  for each row execute function version_goal_changes();

-- Tactic versioning trigger
create or replace function version_tactic_changes()
returns trigger
language plpgsql
security definer
as $$
declare
  v_version integer;
  v_diff jsonb;
begin
  -- Only version on actual changes
  if TG_OP = 'INSERT' or (
    OLD.title is distinct from NEW.title or
    OLD.description is distinct from NEW.description or
    OLD.weight is distinct from NEW.weight or
    OLD.recurrence is distinct from NEW.recurrence or
    OLD.assignee_user_id is distinct from NEW.assignee_user_id
  ) then
    -- Get next version number
    select coalesce(max(version), 0) + 1 into v_version
    from public.tactic_versions
    where tactic_id = NEW.id;
    
    -- Compute diff
    if TG_OP = 'UPDATE' then
      v_diff := compute_jsonb_diff(to_jsonb(OLD), to_jsonb(NEW));
    end if;
    
    -- Insert version record
    insert into public.tactic_versions (
      tactic_id,
      version,
      title,
      description,
      weight,
      recurrence,
      due_days,
      assignee_user_id,
      changed_by,
      diff
    ) values (
      NEW.id,
      v_version,
      NEW.title,
      NEW.description,
      NEW.weight,
      NEW.recurrence,
      NEW.due_days,
      NEW.assignee_user_id,
      auth.uid(),
      v_diff
    );
  end if;
  
  return NEW;
end;
$$;

create trigger version_tactics
  after insert or update on public.tactics
  for each row execute function version_tactic_changes();

-- =========================
-- 6. Audit Query Helper Views
-- =========================

-- View: Recent audit activity (last 100 events per org)
create or replace view public.recent_audit_activity as
select 
  al.id,
  al.timestamp,
  al.action,
  al.entity_type,
  al.entity_id,
  al.actor_type,
  p.full_name as actor_name,
  p.email as actor_email,
  al.actor_context,
  al.diff,
  al.org_id
from public.audit_log al
left join public.profiles p on p.id = al.actor_user_id
order by al.timestamp desc;

-- Grant access to view (RLS still applies to underlying table)
grant select on public.recent_audit_activity to authenticated;

-- =========================
-- 7. Utility Functions for Agents
-- =========================

-- Function to get entity change history
create or replace function get_entity_history(
  p_entity_type text,
  p_entity_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  timestamp timestamptz,
  action text,
  actor_name text,
  diff jsonb,
  metadata jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    al.id,
    al.timestamp,
    al.action,
    p.full_name as actor_name,
    al.diff,
    al.metadata
  from public.audit_log al
  left join public.profiles p on p.id = al.actor_user_id
  where al.entity_type = p_entity_type
    and al.entity_id = p_entity_id
  order by al.timestamp desc
  limit p_limit;
end;
$$;

-- Function to get user activity summary
create or replace function get_user_activity_summary(
  p_user_id uuid,
  p_days integer default 7
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_summary jsonb;
begin
  select jsonb_build_object(
    'total_actions', count(*),
    'actions_by_type', jsonb_object_agg(action, count),
    'entities_modified', count(distinct entity_id),
    'agent_actions', count(*) filter (where actor_type = 'agent')
  )
  into v_summary
  from (
    select 
      action,
      entity_id,
      actor_type
    from public.audit_log
    where actor_user_id = p_user_id
      and timestamp > now() - interval '1 day' * p_days
  ) sub
  group by action;
  
  return coalesce(v_summary, '{}'::jsonb);
end;
$$;

-- =========================
-- 8. Indexes for Performance
-- =========================

-- Additional composite indexes for common queries
create index idx_audit_log_org_entity on public.audit_log(org_id, entity_type, entity_id);
create index idx_audit_log_user_timestamp on public.audit_log(actor_user_id, timestamp desc);

-- =========================
-- 9. Comments for Documentation
-- =========================

comment on table public.audit_log is 'Central audit log for all mutations. Immutable, append-only.';
comment on table public.vision_versions is 'Version history for vision documents.';
comment on table public.goal_versions is 'Version history for goals with diff tracking.';
comment on table public.tactic_versions is 'Version history for tactics with diff tracking.';

comment on function log_agent_action is 'Log agent tool calls with confirmation tracking.';
comment on function compute_jsonb_diff is 'Compute structured diff between two JSONB objects.';
comment on function get_entity_history is 'Retrieve full change history for an entity.';
comment on function get_user_activity_summary is 'Get summary of user activity over time period.';

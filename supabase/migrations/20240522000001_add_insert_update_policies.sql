-- Add INSERT policies for all tables

-- Profiles: users can insert their own profile
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Organizations: any authenticated user can create an org
create policy "Authenticated users can create organizations" on public.organizations
  for insert with check (auth.uid() = created_by);

-- Org members: org owners can add members
create policy "Org owners can add members" on public.org_members
  for insert with check (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
    )
    OR
    -- Allow user to add themselves when creating an org (no existing owner yet)
    (
      org_members.user_id = auth.uid()
      AND org_members.role = 'owner'
      AND NOT exists (
        select 1 from public.org_members m
        where m.org_id = org_members.org_id
      )
    )
  );

-- Teams: org owners/managers can create teams
create policy "Org owners can create teams" on public.teams
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = teams.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'manager')
    )
  );

-- Team members: team managers can add members
create policy "Team managers can add team members" on public.team_members
  for insert with check (
    exists (
      select 1 from public.teams
      join public.org_members on org_members.org_id = teams.org_id
      where teams.id = team_members.team_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'manager')
    )
  );

-- Cycles: org members can create cycles
create policy "Org members can create cycles" on public.cycles
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = cycles.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Visions: org members can create visions
create policy "Org members can create visions" on public.visions
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = visions.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Goals: org members can create goals
create policy "Org members can create goals" on public.goals
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = goals.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactics: org members can create tactics
create policy "Org members can create tactics" on public.tactics
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactics.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactic instances: org members can create instances
create policy "Org members can create tactic instances" on public.tactic_instances
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactic_instances.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Weekly plans: org members can create weekly plans
create policy "Org members can create weekly plans" on public.weekly_plans
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_plans.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Add UPDATE policies

-- Profiles: users can update their own profile (already exists via initial schema)

-- Organizations: org owners can update
create policy "Org owners can update organizations" on public.organizations
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = auth.uid()
      and org_members.role = 'owner'
    )
  );

-- Org members: owners can update member roles
create policy "Org owners can update members" on public.org_members
  for update using (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
    )
  );

-- Teams: org owners/managers can update
create policy "Org owners can update teams" on public.teams
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = teams.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'manager')
    )
  );

-- Cycles: org members can update cycles
create policy "Org members can update cycles" on public.cycles
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = cycles.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Visions: org members can update visions
create policy "Org members can update visions" on public.visions
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = visions.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Goals: org members can update goals
create policy "Org members can update goals" on public.goals
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = goals.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactics: org members can update tactics
create policy "Org members can update tactics" on public.tactics
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactics.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactic instances: org members can update instances
create policy "Org members can update tactic instances" on public.tactic_instances
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactic_instances.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Weekly plans: org members can update weekly plans
create policy "Org members can update weekly plans" on public.weekly_plans
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_plans.org_id
      and org_members.user_id = auth.uid()
    )
  );

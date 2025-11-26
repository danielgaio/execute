-- Add INSERT policies for core tables

-- Profiles: Users can insert their own profile (handled by trigger, but adding policy for safety)
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Organizations: Any authenticated user can create an organization
create policy "Authenticated users can create organizations" on public.organizations
  for insert with check (auth.uid() is not null);

-- Org_members: Allow inserting membership for orgs where user is owner
create policy "Org owners can add members" on public.org_members
  for insert with check (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
    )
    or 
    -- Allow self-insertion when creating org (first member)
    (auth.uid() = user_id and org_members.role = 'owner')
  );

-- Teams: Org members with manager+ role can create teams
create policy "Managers can create teams" on public.teams
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = teams.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'manager')
    )
  );

-- Cycles: Org members can create cycles
create policy "Org members can create cycles" on public.cycles
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = cycles.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Visions: Org members can create visions
create policy "Org members can create visions" on public.visions
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = visions.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Goals: Org members can create goals
create policy "Org members can create goals" on public.goals
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = goals.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactics: Org members can create tactics
create policy "Org members can create tactics" on public.tactics
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactics.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactic_instances: Org members can create instances
create policy "Org members can create tactic instances" on public.tactic_instances
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactic_instances.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Weekly_plans: Org members can create plans
create policy "Org members can create weekly plans" on public.weekly_plans
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_plans.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Add UPDATE policies

-- Profiles: Users can update their own profile
-- (already exists from initial migration)

-- Organizations: Only owners can update
create policy "Owners can update organizations" on public.organizations
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = auth.uid()
      and org_members.role = 'owner'
    )
  );

-- Cycles: Org members can update cycles
create policy "Org members can update cycles" on public.cycles
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = cycles.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Visions: Users can update their own visions
create policy "Users can update their own visions" on public.visions
  for update using (
    user_id = auth.uid()
    and exists (
      select 1 from public.org_members
      where org_members.org_id = visions.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Goals: Org members can update goals
create policy "Org members can update goals" on public.goals
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = goals.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactics: Org members can update tactics
create policy "Org members can update tactics" on public.tactics
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactics.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Tactic_instances: Org members can update instances
create policy "Org members can update tactic instances" on public.tactic_instances
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactic_instances.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Weekly_plans: Org members can update plans
create policy "Org members can update weekly plans" on public.weekly_plans
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_plans.org_id
      and org_members.user_id = auth.uid()
    )
  );

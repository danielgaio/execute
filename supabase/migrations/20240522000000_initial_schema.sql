-- Enable pgvector extension
create extension if not exists vector;

-- Create profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  locale text default 'en',
  timezone text default 'UTC',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Create organizations table
create table public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.organizations enable row level security;

-- Create org_members table
create table public.org_members (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('owner', 'manager', 'member', 'viewer')),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

alter table public.org_members enable row level security;

-- RLS for organizations: visible to members
create policy "Members can view organizations they belong to" on public.organizations
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = auth.uid()
    )
  );

-- RLS for org_members: visible to members of the same org
create policy "Members can view other members of their org" on public.org_members
  for select using (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
      and m.user_id = auth.uid()
    )
  );

-- Create teams table
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.teams enable row level security;

create policy "Org members can view teams in their org" on public.teams
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = teams.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create team_members table
create table public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('manager', 'member')),
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

alter table public.team_members enable row level security;

create policy "Org members can view team members in their org" on public.team_members
  for select using (
    exists (
      select 1 from public.teams
      join public.org_members on org_members.org_id = teams.org_id
      where teams.id = team_members.team_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create cycles table
create table public.cycles (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade, -- Optional, can be org-wide or team-specific
  owner_user_id uuid references public.profiles(id),
  title text not null,
  start_date date not null,
  end_date date not null,
  status text default 'active' check (status in ('draft', 'active', 'completed', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cycles enable row level security;

create policy "Org members can view cycles" on public.cycles
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = cycles.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create visions table
create table public.visions (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id),
  content_md text,
  version integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.visions enable row level security;

create policy "Org members can view visions" on public.visions
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = visions.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create goals table (Lag Indicators)
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  cycle_id uuid references public.cycles(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  owner_user_id uuid references public.profiles(id),
  title text not null,
  description text,
  unit text, -- e.g., 'USD', '%', 'count'
  baseline numeric,
  target numeric,
  target_date date,
  status text default 'on_track' check (status in ('on_track', 'at_risk', 'off_track', 'completed', 'abandoned')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.goals enable row level security;

create policy "Org members can view goals" on public.goals
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = goals.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create tactics table (Lead Indicators)
create table public.tactics (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references public.goals(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  title text not null,
  description text,
  weight numeric default 1.0 check (weight > 0 and weight <= 1.0),
  recurrence text default 'weekly' check (recurrence in ('one_off', 'weekly', 'daily', 'custom')),
  due_days integer[], -- Array of days (1=Monday, 7=Sunday) for weekly recurrence
  assignee_user_id uuid references public.profiles(id),
  status text default 'active' check (status in ('active', 'completed', 'paused', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tactics enable row level security;

create policy "Org members can view tactics" on public.tactics
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactics.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create tactic_instances table
create table public.tactic_instances (
  id uuid default gen_random_uuid() primary key,
  tactic_id uuid references public.tactics(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  week_start date not null, -- The Monday of the week
  due_date date not null,
  planned boolean default true,
  status text default 'pending' check (status in ('pending', 'done', 'skipped', 'deferred')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tactic_instances enable row level security;

create policy "Org members can view tactic instances" on public.tactic_instances
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactic_instances.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create weekly_plans table
create table public.weekly_plans (
  id uuid default gen_random_uuid() primary key,
  cycle_id uuid references public.cycles(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  week_start date not null,
  owner_user_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  status text default 'draft' check (status in ('draft', 'committed', 'reviewed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.weekly_plans enable row level security;

create policy "Org members can view weekly plans" on public.weekly_plans
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_plans.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

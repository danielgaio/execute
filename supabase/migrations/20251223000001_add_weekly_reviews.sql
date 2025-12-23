-- Create weekly_reviews table
create table public.weekly_reviews (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  cycle_id uuid references public.cycles(id) on delete cascade not null,
  week_start date not null,
  lead_score numeric not null, -- The execution score (0-100)
  lag_status text, -- Summary of goal status (e.g., "2 on track, 1 at risk")
  notes text, -- The qualitative review
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, cycle_id, week_start)
);

-- Enable RLS
alter table public.weekly_reviews enable row level security;

-- RLS Policies
create policy "Org members can view weekly reviews" on public.weekly_reviews
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_reviews.org_id
      and org_members.user_id = auth.uid()
    )
  );

create policy "Org managers and owners can create weekly reviews" on public.weekly_reviews
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_reviews.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'manager')
    )
  );

create policy "Org managers and owners can update weekly reviews" on public.weekly_reviews
  for update using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = weekly_reviews.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'manager')
    )
  );

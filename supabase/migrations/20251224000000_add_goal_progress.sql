-- Add current_value to goals for caching the latest value
alter table public.goals 
add column current_value numeric;

-- Create goal_measurements table for history
create table public.goal_measurements (
  id uuid default gen_random_uuid() primary key,
  goal_id uuid references public.goals(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  value numeric not null,
  measured_at timestamptz default now(),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.goal_measurements enable row level security;

create policy "Org members can view goal measurements" on public.goal_measurements
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = goal_measurements.org_id
      and org_members.user_id = auth.uid()
    )
  );

create policy "Org managers and owners can add measurements" on public.goal_measurements
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = goal_measurements.org_id
      and org_members.user_id = auth.uid()
      and org_members.role in ('owner', 'manager')
    )
  );

-- Function to update goal.current_value on new measurement
create or replace function public.update_goal_current_value()
returns trigger as $$
begin
  update public.goals
  set current_value = new.value,
      updated_at = now()
  where id = new.goal_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_measurement_created
  after insert on public.goal_measurements
  for each row execute procedure public.update_goal_current_value();

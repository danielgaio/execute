-- Add recurrence_interval to tactics table
alter table public.tactics 
add column recurrence_interval integer default 1 check (recurrence_interval > 0);

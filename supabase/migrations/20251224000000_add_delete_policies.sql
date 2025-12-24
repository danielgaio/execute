-- Add DELETE policies for tactics
create policy "Org members can delete tactics" on public.tactics
  for delete using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactics.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Add DELETE policies for tactic_instances (just in case cascade doesn't cover direct deletion)
create policy "Org members can delete tactic instances" on public.tactic_instances
  for delete using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = tactic_instances.org_id
      and org_members.user_id = auth.uid()
    )
  );

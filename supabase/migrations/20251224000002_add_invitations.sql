-- Migration: Add invitations table for organization member invitations
-- Created: 2025-12-24

-- Create invitations table
create table public.invitations (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'member', 'viewer')),
  team_ids uuid[] default null,
  token text not null unique,
  invited_by uuid references public.profiles(id) not null,
  expires_at timestamptz not null,
  accepted_at timestamptz default null,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_invitations_org_id on public.invitations(org_id);
create index idx_invitations_token on public.invitations(token);
create index idx_invitations_email on public.invitations(email);
create index idx_invitations_expires_at on public.invitations(expires_at);

-- Enable RLS
alter table public.invitations enable row level security;

-- RLS Policies for invitations

-- Owners and managers can view invitations for their org
create policy "Org managers can view invitations" on public.invitations
  for select using (
    exists (
      select 1 from public.org_members m
      where m.org_id = invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'manager')
    )
  );

-- Owners and managers can create invitations
create policy "Org managers can create invitations" on public.invitations
  for insert with check (
    exists (
      select 1 from public.org_members m
      where m.org_id = invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'manager')
    )
  );

-- Owners and managers can update invitations (for revocation/expiry)
create policy "Org managers can update invitations" on public.invitations
  for update using (
    exists (
      select 1 from public.org_members m
      where m.org_id = invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'manager')
    )
  );

-- Anyone can read their own invitation by token (public endpoint)
-- This is handled at the application layer, not via RLS
-- because the user might not be authenticated yet

-- Add comment
comment on table public.invitations is 'Organization membership invitations with secure tokens';

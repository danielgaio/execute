-- Create embeddings table for RAG
create table public.embeddings (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata jsonb default '{}'::jsonb, -- To store entity_type, entity_id, etc.
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.embeddings enable row level security;

-- RLS Policy: Org members can view embeddings
create policy "Org members can view embeddings" on public.embeddings
  for select using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = embeddings.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Org members can insert embeddings (for now, maybe restrict to service role later if needed)
create policy "Org members can insert embeddings" on public.embeddings
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = embeddings.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Org members can delete embeddings
create policy "Org members can delete embeddings" on public.embeddings
  for delete using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = embeddings.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Create HNSW index for faster similarity search
create index on public.embeddings using hnsw (embedding vector_cosine_ops);

-- Function to match embeddings
create or replace function match_embeddings (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_org_id uuid
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    embeddings.id,
    embeddings.content,
    embeddings.metadata,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from embeddings
  where 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  and embeddings.org_id = filter_org_id
  order by embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

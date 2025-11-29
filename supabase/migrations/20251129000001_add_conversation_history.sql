-- Create conversations table
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.conversations enable row level security;

create policy "Users can view their own conversations" on public.conversations
  for select using (auth.uid() = user_id);

create policy "Users can insert their own conversations" on public.conversations
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own conversations" on public.conversations
  for update using (auth.uid() = user_id);

create policy "Users can delete their own conversations" on public.conversations
  for delete using (auth.uid() = user_id);

-- Create messages table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text,
  tool_calls jsonb, -- Stores the array of tool calls for assistant messages
  tool_call_id text, -- Stores the tool_call_id for tool response messages
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users can view messages in their conversations" on public.messages
  for select using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their conversations" on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

-- Index for faster retrieval
create index messages_conversation_id_idx on public.messages(conversation_id);
create index conversations_user_id_idx on public.conversations(user_id);

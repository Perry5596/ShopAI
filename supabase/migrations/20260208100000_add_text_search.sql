-- Migration: Add text search (agentic AI) tables
-- Creates conversations, messages, search_categories, and search_products tables
-- for the new agentic text search feature

-- ============================================================================
-- CONVERSATIONS TABLE
-- Chat sessions for text-based product search
-- ============================================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text, -- AI-generated from first query (e.g., "Protein Powder")
  status text default 'active' check (status in ('active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index conversations_user_id_idx on public.conversations(user_id);
create index conversations_created_at_idx on public.conversations(created_at desc);

-- Enable RLS
alter table public.conversations enable row level security;

-- Policies
create policy "Users can view own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute procedure public.handle_updated_at();

-- ============================================================================
-- MESSAGES TABLE
-- Individual messages in a conversation (user or assistant)
-- ============================================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null, -- display text
  metadata jsonb default '{}', -- stores tool calls, search params, model info
  created_at timestamptz default now()
);

-- Indexes
create index messages_conversation_id_idx on public.messages(conversation_id);
create index messages_created_at_idx on public.messages(created_at);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies (access through conversation ownership)
create policy "Users can view messages of own conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert messages to own conversations"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can delete messages of own conversations"
  on public.messages for delete
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

-- ============================================================================
-- SEARCH CATEGORIES TABLE
-- AI-generated product categories per assistant message
-- ============================================================================
create table public.search_categories (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  message_id uuid references public.messages(id) on delete cascade not null,
  label text not null, -- e.g., "Whey Protein"
  search_query text not null, -- actual query sent to Amazon
  description text, -- AI reasoning for this category
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Indexes
create index search_categories_conversation_id_idx on public.search_categories(conversation_id);
create index search_categories_message_id_idx on public.search_categories(message_id);

-- Enable RLS
alter table public.search_categories enable row level security;

-- Policies (access through conversation ownership)
create policy "Users can view search categories of own conversations"
  on public.search_categories for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = search_categories.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert search categories to own conversations"
  on public.search_categories for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = search_categories.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can delete search categories of own conversations"
  on public.search_categories for delete
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = search_categories.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

-- ============================================================================
-- SEARCH PRODUCTS TABLE
-- Products returned per search category
-- ============================================================================
create table public.search_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.search_categories(id) on delete cascade not null,
  title text not null,
  price text, -- available from Creators API
  image_url text,
  affiliate_url text not null,
  source text not null default 'Amazon',
  asin text, -- Amazon Standard Identification Number
  rating decimal,
  review_count integer,
  brand text,
  created_at timestamptz default now()
);

-- Indexes
create index search_products_category_id_idx on public.search_products(category_id);
create index search_products_asin_idx on public.search_products(asin);

-- Enable RLS
alter table public.search_products enable row level security;

-- Policies (access through conversation → category ownership)
create policy "Users can view search products of own conversations"
  on public.search_products for select
  using (
    exists (
      select 1 from public.search_categories
      join public.conversations on conversations.id = search_categories.conversation_id
      where search_categories.id = search_products.category_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert search products to own conversations"
  on public.search_products for insert
  with check (
    exists (
      select 1 from public.search_categories
      join public.conversations on conversations.id = search_categories.conversation_id
      where search_categories.id = search_products.category_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can delete search products of own conversations"
  on public.search_products for delete
  using (
    exists (
      select 1 from public.search_categories
      join public.conversations on conversations.id = search_categories.conversation_id
      where search_categories.id = search_products.category_id
      and conversations.user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on table public.conversations is 'Chat sessions for agentic text-based product search';
comment on table public.messages is 'Individual messages (user or assistant) in a search conversation';
comment on table public.search_categories is 'AI-generated product categories per assistant message';
comment on table public.search_products is 'Products returned from retailer APIs per search category';

comment on column public.conversations.title is 'AI-generated title from the first user query';
comment on column public.conversations.status is 'Conversation state: active or archived';
comment on column public.messages.role is 'Message author: user or assistant';
comment on column public.messages.metadata is 'JSON blob for tool calls, search params, model info';
comment on column public.search_categories.label is 'Display label for the category (e.g., Whey Protein)';
comment on column public.search_categories.search_query is 'Actual search query sent to the retailer API';
comment on column public.search_categories.description is 'AI-generated explanation of why this category is relevant';
comment on column public.search_categories.sort_order is 'Display order for categories within a message';
comment on column public.search_products.asin is 'Amazon Standard Identification Number';
comment on column public.search_products.source is 'Retailer source (e.g., Amazon, Best Buy) for future multi-retailer support';

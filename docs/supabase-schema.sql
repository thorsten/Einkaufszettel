-- Einkaufszettel — Supabase schema
--
-- Run this once in the Supabase SQL editor before enabling cloud sync.
-- One table holds every item across every household. The "household" UUID
-- partitions data; both phones in the same household use the same UUID.
--
-- Security model: the household UUID functions as a shared secret. Treat
-- it like a password. Anyone with the URL + anon key + household UUID can
-- read and write that household's items. For higher security, add Supabase
-- Auth + a household-membership table and tighten the RLS policies below.

create table if not exists public.einkaufszettel_items (
  household   uuid        not null,
  id          text        not null,
  shop        text        not null,
  name        text        not null,
  qty         text,
  cat         text,
  done        boolean     not null default false,
  tomb        boolean     not null default false,
  pos         numeric     not null default 0,
  ts          bigint      not null,
  lamport     bigint      not null,
  dev         text        not null,
  updated_at  timestamptz not null default now(),
  primary key (household, id)
);

create index if not exists einkaufszettel_items_household_idx
  on public.einkaufszettel_items (household);

-- Bump updated_at on every modification (useful for ad-hoc queries / debugging)
create or replace function public.einkaufszettel_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists einkaufszettel_touch on public.einkaufszettel_items;
create trigger einkaufszettel_touch
  before update on public.einkaufszettel_items
  for each row execute function public.einkaufszettel_touch_updated_at();

-- Row-level security
alter table public.einkaufszettel_items enable row level security;

-- Permissive policies — security comes from secrecy of household UUID.
-- Tighten these (or replace with auth-based policies) for stricter setups.
drop policy if exists einkaufszettel_select on public.einkaufszettel_items;
create policy einkaufszettel_select on public.einkaufszettel_items
  for select using (true);

drop policy if exists einkaufszettel_insert on public.einkaufszettel_items;
create policy einkaufszettel_insert on public.einkaufszettel_items
  for insert with check (true);

drop policy if exists einkaufszettel_update on public.einkaufszettel_items;
create policy einkaufszettel_update on public.einkaufszettel_items
  for update using (true) with check (true);

-- Realtime publication so phones receive INSERT / UPDATE events.
alter publication supabase_realtime add table public.einkaufszettel_items;

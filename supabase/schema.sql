-- Supabase schema for Planning Poker (v1 - no history yet)
-- Goal: keep all reads/writes server-side (Service Role) + token-based access.

create extension if not exists pgcrypto;

create table if not exists public.games (
  id text primary key,
  name text not null,
  game_type text not null,
  cards jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_by_id text not null,
  is_allow_members_to_manage_session boolean not null default false,
  story_name text,
  auto_reveal boolean not null default false,
  game_status text not null,
  timer_props jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  join_token_hash text not null,
  admin_token_hash text not null
);

create table if not exists public.players (
  id text primary key,
  game_id text not null references public.games (id) on delete cascade,
  name text not null,
  status text not null,
  value double precision,
  emoji text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  player_token_hash text not null
);

create index if not exists players_game_id_idx on public.players (game_id);
create index if not exists games_created_at_idx on public.games (created_at desc);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_games_updated_at on public.games;
create trigger set_games_updated_at
before update on public.games
for each row
execute function public.set_updated_at();

drop trigger if exists set_players_updated_at on public.players;
create trigger set_players_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

-- High security default: deny direct client access.
alter table public.games enable row level security;
alter table public.players enable row level security;

-- Intentionally no RLS policies here.
-- Use the Service Role key (server-side) for all DB reads/writes.

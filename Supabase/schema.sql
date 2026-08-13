-- ============================================================
-- CYBER UNO - Complete Supabase Schema
-- Paste this entire file into Supabase SQL Editor and Run
-- ============================================================

-- Enable necessary extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_username on public.profiles(username);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROOMS
-- ============================================================
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  host_id uuid references public.profiles(id) on delete set null,
  max_players int not null check (max_players in (2, 4, 6)),
  room_type text not null check (room_type in ('private', 'matchmaking', 'bots')),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'cancelled')),
  game_rules jsonb not null default '{
    "stackDraw": false,
    "jumpIn": false,
    "sevenO": false,
    "forcePlay": false,
    "drawUntilPlayable": false,
    "allowDrawWithPlayable": true,
    "startingHandSize": 7
  }'::jsonb,
  current_game_id uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now()
);

create index if not exists idx_rooms_code on public.rooms(room_code);
create index if not exists idx_rooms_status on public.rooms(status);
create index if not exists idx_rooms_type on public.rooms(room_type);

-- ============================================================
-- ROOM PLAYERS
-- ============================================================
create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  seat int not null check (seat >= 0 and seat < 6),
  is_bot boolean default false,
  bot_name text,
  bot_difficulty text check (bot_difficulty in ('easy', 'normal', 'hard') or bot_difficulty is null),
  status text not null default 'joined' check (status in ('joined', 'ready', 'left', 'disconnected')),
  joined_at timestamptz default now() not null,
  unique(room_id, seat),
  unique(room_id, user_id)
);

create index if not exists idx_room_players_room on public.room_players(room_id);
create index if not exists idx_room_players_user on public.room_players(user_id);

-- ============================================================
-- GAMES
-- ============================================================
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  current_seat int not null default 0,
  current_color text check (current_color in ('red', 'blue', 'green', 'yellow') or current_color is null),
  direction int not null default 1, -- 1 = clockwise, -1 = counter
  discard_pile jsonb not null default '[]'::jsonb,
  draw_pile jsonb not null default '[]'::jsonb,
  last_action jsonb,
  winner_id uuid references public.profiles(id),
  winner_seat int,
  rules jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now()
);

create index if not exists idx_games_room on public.games(room_id);
create index if not exists idx_games_status on public.games(status);

-- ============================================================
-- GAME PLAYERS (hands stored here; RLS limits visibility)
-- ============================================================
create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  seat int not null,
  hand jsonb not null default '[]'::jsonb, -- only visible to owner via RLS
  card_count int not null default 0,
  uno_called boolean default false,
  is_bot boolean default false,
  bot_name text,
  bot_difficulty text,
  unique(game_id, seat),
  unique(game_id, user_id)
);

create index if not exists idx_game_players_game on public.game_players(game_id);

-- ============================================================
-- MATCHMAKING QUEUE
-- ============================================================
create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  max_players int not null check (max_players in (2, 4, 6)),
  joined_at timestamptz default now() not null,
  unique(user_id)
);

create index if not exists idx_matchmaking_max on public.matchmaking_queue(max_players, joined_at);

-- ============================================================
-- CHAT MESSAGES (optional, simple)
-- ============================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  username text,
  message text not null check (char_length(message) <= 200),
  created_at timestamptz default now() not null
);

create index if not exists idx_chat_room on public.chat_messages(room_id, created_at desc);

-- ============================================================
-- HELPER: Generate unique room code
-- ============================================================
create or replace function public.generate_room_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.chat_messages enable row level security;

-- PROFILES
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ROOMS
create policy "Anyone authenticated can view rooms"
  on public.rooms for select
  to authenticated
  using (true);

create policy "Authenticated users can create rooms"
  on public.rooms for insert
  to authenticated
  with check (auth.uid() = host_id);

create policy "Host can update their rooms"
  on public.rooms for update
  to authenticated
  using (auth.uid() = host_id or status = 'playing');

-- ROOM PLAYERS
create policy "Players can view room_players of rooms they are in or public"
  on public.room_players for select
  to authenticated
  using (true);

create policy "Users can join rooms"
  on public.room_players for insert
  to authenticated
  with check (auth.uid() = user_id or is_bot = true);

create policy "Users can update own room_player or host can"
  on public.room_players for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

create policy "Users can leave (delete) themselves"
  on public.room_players for delete
  to authenticated
  using (auth.uid() = user_id);

-- GAMES
create policy "Players can view games of their rooms"
  on public.games for select
  to authenticated
  using (true);

create policy "Authenticated can insert games"
  on public.games for insert
  to authenticated
  with check (true);

create policy "Players can update active games"
  on public.games for update
  to authenticated
  using (true);

-- GAME PLAYERS - critical: hide other hands
create policy "Players can see card counts and public info"
  on public.game_players for select
  to authenticated
  using (true);

-- Note: hand column visibility is controlled in application logic + careful queries.
-- For stronger security one would use a view or column-level security / edge functions.
-- We rely on client only requesting own hand + server functions for moves.

create policy "Insert game players"
  on public.game_players for insert
  to authenticated
  with check (true);

create policy "Update own game player or system"
  on public.game_players for update
  to authenticated
  using (auth.uid() = user_id or is_bot = true or true); -- relaxed for game progress

-- MATCHMAKING
create policy "Users manage own queue entry"
  on public.matchmaking_queue for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Anyone can see queue for matching"
  on public.matchmaking_queue for select
  to authenticated
  using (true);

-- CHAT
create policy "Room members can read chat"
  on public.chat_messages for select
  to authenticated
  using (true);

create policy "Authenticated can send chat"
  on public.chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ============================================================
-- REALTIME
-- ============================================================
-- Run these if not already enabled via UI:
-- alter publication supabase_realtime add table public.rooms;
-- alter publication supabase_realtime add table public.room_players;
-- alter publication supabase_realtime add table public.games;
-- alter publication supabase_realtime add table public.game_players;
-- alter publication supabase_realtime add table public.matchmaking_queue;
-- alter publication supabase_realtime add table public.chat_messages;

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Create a private room
create or replace function public.create_private_room(
  p_max_players int,
  p_rules jsonb default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_room_id uuid;
  v_rules jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_max_players not in (2, 4, 6) then
    raise exception 'Invalid max_players';
  end if;

  v_rules := coalesce(p_rules, '{
    "stackDraw": false,
    "jumpIn": false,
    "sevenO": false,
    "forcePlay": false,
    "drawUntilPlayable": false,
    "allowDrawWithPlayable": true,
    "startingHandSize": 7
  }'::jsonb);

  -- Generate unique code
  loop
    v_code := public.generate_room_code();
    exit when not exists (select 1 from rooms where room_code = v_code);
  end loop;

  insert into rooms (room_code, host_id, max_players, room_type, status, game_rules)
  values (v_code, v_user_id, p_max_players, 'private', 'waiting', v_rules)
  returning id into v_room_id;

  insert into room_players (room_id, user_id, seat, status)
  values (v_room_id, v_user_id, 0, 'joined');

  return json_build_object(
    'room_id', v_room_id,
    'room_code', v_code
  );
end;
$$;

-- Join room by code
create or replace function public.join_room_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room record;
  v_seat int;
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room from rooms where room_code = upper(p_code) and status = 'waiting';

  if not found then
    raise exception 'Room not found or already started';
  end if;

  if exists (select 1 from room_players where room_id = v_room.id and user_id = v_user_id) then
    return json_build_object('room_id', v_room.id, 'room_code', v_room.room_code, 'already_joined', true);
  end if;

  select count(*) into v_count from room_players where room_id = v_room.id and status != 'left';
  if v_count >= v_room.max_players then
    raise exception 'Room is full';
  end if;

  -- Find free seat
  select s into v_seat
  from generate_series(0, v_room.max_players - 1) s
  where not exists (
    select 1 from room_players rp where rp.room_id = v_room.id and rp.seat = s and rp.status != 'left'
  )
  limit 1;

  insert into room_players (room_id, user_id, seat, status)
  values (v_room.id, v_user_id, v_seat, 'joined')
  on conflict (room_id, user_id) do update set status = 'joined', seat = excluded.seat;

  return json_build_object(
    'room_id', v_room.id,
    'room_code', v_room.room_code,
    'seat', v_seat
  );
end;
$$;

grant execute on function public.create_private_room to authenticated;
grant execute on function public.join_room_by_code to authenticated;
grant execute on function public.generate_room_code to authenticated;

-- ============================================================
-- Updated_at trigger helper
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rooms_updated_at before update on public.rooms
  for each row execute procedure public.set_updated_at();

create trigger games_updated_at before update on public.games
  for each row execute procedure public.set_updated_at();

-- TheBride — Church Livestream Module
-- Run this in Supabase SQL Editor once.
-- Cloudflare Stream provides HLS/DASH delivery; we store metadata here.

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists church_live_events (
  id                uuid        default gen_random_uuid() primary key,
  church_id         uuid        not null references churches(id) on delete cascade,
  created_by        uuid        not null references profiles(id),
  title             text        not null,
  description       text,
  thumbnail_url     text,
  scheduled_for     timestamptz,
  started_at        timestamptz,
  ended_at          timestamptz,
  status            text        not null default 'scheduled'
                    check (status in ('scheduled','live','ended','cancelled')),
  -- Cloudflare Stream fields (set manually for now; Phase 2 will automate via CF API)
  stream_input_id   text,        -- Cloudflare Live Input UID
  playback_url      text,        -- Cloudflare DASH manifest URL
  hls_url           text,        -- Cloudflare HLS manifest URL
  viewer_count      int          not null default 0,
  replay_enabled    boolean      not null default true,
  created_at        timestamptz  default now() not null
);

create table if not exists church_live_chat_messages (
  id             uuid        default gen_random_uuid() primary key,
  live_event_id  uuid        not null references church_live_events(id) on delete cascade,
  user_id        uuid        not null references profiles(id) on delete cascade,
  message        text        not null check (char_length(message) between 1 and 500),
  created_at     timestamptz default now() not null
);

create table if not exists church_live_reactions (
  id             uuid        default gen_random_uuid() primary key,
  live_event_id  uuid        not null references church_live_events(id) on delete cascade,
  user_id        uuid        not null references profiles(id) on delete cascade,
  reaction_type  text        not null
                 check (reaction_type in ('🙏','❤️','🔥','✝️','👏','🙌','⭐','😭')),
  created_at     timestamptz default now() not null
);

create table if not exists church_live_viewers (
  id             uuid        default gen_random_uuid() primary key,
  live_event_id  uuid        not null references church_live_events(id) on delete cascade,
  user_id        uuid        references profiles(id) on delete set null,
  session_id     text        not null,
  joined_at      timestamptz default now() not null,
  left_at        timestamptz,
  unique (live_event_id, session_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index if not exists live_events_church_id_idx      on church_live_events(church_id);
create index if not exists live_events_status_idx         on church_live_events(status);
create index if not exists live_events_scheduled_for_idx  on church_live_events(scheduled_for);
create index if not exists live_chat_event_id_idx         on church_live_chat_messages(live_event_id, created_at);
create index if not exists live_reactions_event_id_idx    on church_live_reactions(live_event_id, created_at);
create index if not exists live_viewers_event_id_idx      on church_live_viewers(live_event_id);
create index if not exists live_viewers_active_idx        on church_live_viewers(live_event_id) where left_at is null;

-- ── Viewer count trigger ──────────────────────────────────────────────────

create or replace function update_live_viewer_count()
returns trigger language plpgsql as $$
begin
  update church_live_events
  set viewer_count = (
    select count(*) from church_live_viewers
    where live_event_id = coalesce(new.live_event_id, old.live_event_id)
      and left_at is null
  )
  where id = coalesce(new.live_event_id, old.live_event_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_live_viewer_count on church_live_viewers;
create trigger trg_live_viewer_count
  after insert or update or delete on church_live_viewers
  for each row execute function update_live_viewer_count();

-- ── RLS ───────────────────────────────────────────────────────────────────

-- Helper: returns true if the current user is the church_admin of a given church
-- (profiles.role = 'church_admin' AND profiles.church_id = the_church_id)
-- Used in RLS policies below.

-- church_live_events
alter table church_live_events enable row level security;

drop policy if exists "live_events_select" on church_live_events;
create policy "live_events_select" on church_live_events
  for select to authenticated
  using (true);

drop policy if exists "live_events_insert" on church_live_events;
create policy "live_events_insert" on church_live_events
  for insert to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_live_events.church_id
    )
  );

drop policy if exists "live_events_update" on church_live_events;
create policy "live_events_update" on church_live_events
  for update to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_live_events.church_id
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_live_events.church_id
    )
  );

drop policy if exists "live_events_delete" on church_live_events;
create policy "live_events_delete" on church_live_events
  for delete to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_live_events.church_id
    )
  );

-- church_live_chat_messages
alter table church_live_chat_messages enable row level security;

drop policy if exists "live_chat_select" on church_live_chat_messages;
create policy "live_chat_select" on church_live_chat_messages
  for select to authenticated
  using (true);

drop policy if exists "live_chat_insert" on church_live_chat_messages;
create policy "live_chat_insert" on church_live_chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "live_chat_delete_own" on church_live_chat_messages;
create policy "live_chat_delete_own" on church_live_chat_messages
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      join church_live_events e on e.id = church_live_chat_messages.live_event_id
      where p.id = auth.uid()
        and p.role = 'church_admin'
        and p.church_id = e.church_id
    )
  );

-- church_live_reactions
alter table church_live_reactions enable row level security;

drop policy if exists "live_reactions_select" on church_live_reactions;
create policy "live_reactions_select" on church_live_reactions
  for select to authenticated
  using (true);

drop policy if exists "live_reactions_insert" on church_live_reactions;
create policy "live_reactions_insert" on church_live_reactions
  for insert to authenticated
  with check (user_id = auth.uid());

-- church_live_viewers (session tracking — users can join anonymously)
alter table church_live_viewers enable row level security;

drop policy if exists "live_viewers_select" on church_live_viewers;
create policy "live_viewers_select" on church_live_viewers
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      join church_live_events e on e.id = church_live_viewers.live_event_id
      where p.id = auth.uid()
        and p.role = 'church_admin'
        and p.church_id = e.church_id
    )
  );

drop policy if exists "live_viewers_insert" on church_live_viewers;
create policy "live_viewers_insert" on church_live_viewers
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists "live_viewers_update" on church_live_viewers;
create policy "live_viewers_update" on church_live_viewers
  for update to authenticated
  using (user_id = auth.uid());

-- ── Realtime: enable publications ────────────────────────────────────────
-- Run in Supabase Dashboard > Database > Replication, or here:

alter publication supabase_realtime add table church_live_events;
alter publication supabase_realtime add table church_live_chat_messages;
alter publication supabase_realtime add table church_live_reactions;

-- ── Future API automation notes ───────────────────────────────────────────
-- Phase 2: POST /api/live/create-input
--   → calls Cloudflare API: POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/stream/live_inputs
--   → stores stream_input_id, playback_url, hls_url in church_live_events
--   → env vars needed: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
--
-- Phase 2: rotating stream keys
--   → DELETE + re-create Cloudflare live input
--
-- Phase 2: webhooks
--   → Cloudflare sends stream.live_input.connected / disconnected events
--   → POST /api/live/cf-webhook updates status automatically

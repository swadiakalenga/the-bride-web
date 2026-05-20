-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-message-media.sql
-- Adds media_url and media_type columns to the messages table so that
-- in-chat photo, video and audio messages can be stored.
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend the messages table
alter table public.messages
  add column if not exists media_url  text,
  add column if not exists media_type text;

-- 2. Add a check constraint (guarded against duplication)
do $body$
begin
  if not exists (
    select 1
      from pg_constraint  c
      join pg_class        t on t.oid = c.conrelid
      join pg_namespace    n on n.oid = t.relnamespace
     where c.conname = 'messages_media_type_check'
       and t.relname  = 'messages'
       and n.nspname  = 'public'
  ) then
    execute $ddl$
      alter table public.messages
        add constraint messages_media_type_check
        check (media_type is null or media_type in ('image', 'video', 'audio', 'file'))
    $ddl$;
  end if;
end
$body$;

-- 3. Sparse index for media message look-ups
create index if not exists idx_messages_media_url
  on public.messages (media_url)
  where media_url is not null;

-- Note: existing text-only messages have media_url = NULL and media_type = NULL.
-- The check constraint allows NULL, so old rows are unaffected.

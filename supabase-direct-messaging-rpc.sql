-- Direct conversation RPC — run AFTER supabase-production-rls.sql.
-- Wraps the full "create conversation + add participants + send first message"
-- flow in a SECURITY DEFINER function so it succeeds regardless of which
-- RLS policy combination is active on conversations / conversation_participants.

-- ─────────────────────────────────────────────────────────────────────────────
-- create_direct_conversation(p_other_user_id, p_message)
--
-- Caller must be authenticated. Returns the new conversation_id.
-- p_message is optional (pass NULL to create a conversation without a first message).
-- Raises an exception if called with your own user_id.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_direct_conversation(
  p_other_user_id uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me     uuid;
  v_conv_id uuid;
begin
  v_me := auth.uid();

  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if v_me = p_other_user_id then
    raise exception 'Cannot create a conversation with yourself';
  end if;

  -- Create conversation row
  insert into public.conversations default values returning id into v_conv_id;

  -- Add both participants (batch — safe because we own the insert here)
  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conv_id, v_me), (v_conv_id, p_other_user_id);

  -- Optionally send the first message
  if p_message is not null and length(trim(p_message)) > 0 then
    insert into public.messages (conversation_id, sender_id, content)
    values (v_conv_id, v_me, p_message);

    insert into public.notifications (
      recipient_user_id, actor_user_id, type, conversation_id, is_read
    )
    values (p_other_user_id, v_me, 'message', v_conv_id, false);
  end if;

  return v_conv_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid, text) from public;
grant execute on function public.create_direct_conversation(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Safety net: ensure the conversations INSERT policy exists.
-- This is a no-op if supabase-production-rls.sql was already applied correctly.
-- ─────────────────────────────────────────────────────────────────────────────
alter table conversations enable row level security;

drop policy if exists "conversations insert authenticated" on conversations;
create policy "conversations insert authenticated" on conversations
  for insert to authenticated
  with check (true);

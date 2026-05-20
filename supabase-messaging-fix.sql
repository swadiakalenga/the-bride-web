-- Messaging fix: run this in Supabase SQL editor BEFORE applying supabase-production-rls.sql
-- This resolves two issues found during production testing.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. UNIQUE constraint on message_requests(sender_id, recipient_id)
--
--    Required for safe re-sends after a request was ignored/rejected.
--    Without this, re-sends create duplicate rows in the table.
-- ─────────────────────────────────────────────────────────────────────────────
alter table message_requests
  drop constraint if exists message_requests_sender_recipient_unique;

alter table message_requests
  add constraint message_requests_sender_recipient_unique
  unique (sender_id, recipient_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. accept_message_request() — security-definer helper for accepting requests
--
--    When the recipient (auth.uid()) accepts a request, they need to insert a
--    message whose sender_id is the original requester (not themselves).
--    Normal RLS blocks this because "sender_id = auth.uid()" would fail.
--    This function runs as the DB owner (security definer) so it bypasses RLS.
--
--    Usage: select accept_message_request('<request_uuid>');
--    Returns: the new conversation_id on success, raises an exception on failure.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_message_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id     uuid;
  v_recipient_id  uuid;
  v_message       text;
  v_conv_id       uuid;
begin
  -- Only the intended recipient may call this
  select sender_id, recipient_id, initial_message
    into v_sender_id, v_recipient_id, v_message
    from message_requests
   where id = p_request_id
     and recipient_id = auth.uid()
     and status = 'pending';

  if not found then
    raise exception 'Message request not found or you are not the recipient';
  end if;

  -- Create conversation
  insert into conversations default values returning id into v_conv_id;

  -- Add both participants
  insert into conversation_participants (conversation_id, user_id)
  values (v_conv_id, v_recipient_id), (v_conv_id, v_sender_id);

  -- Insert the initial message with the correct sender
  insert into messages (conversation_id, sender_id, content)
  values (v_conv_id, v_sender_id, v_message);

  -- Mark request accepted
  update message_requests set status = 'accepted' where id = p_request_id;

  return v_conv_id;
end;
$$;

-- Only authenticated users can call it (RLS on the function itself is not possible,
-- but the function body verifies auth.uid() = recipient_id).
revoke all on function public.accept_message_request(uuid) from public;
grant execute on function public.accept_message_request(uuid) to authenticated;

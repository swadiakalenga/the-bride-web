-- PayPal Checkout integration columns for TheBride
-- Run AFTER supabase-payments.sql
-- Safe to re-run (all idempotent).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add PayPal columns to donations table
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.donations
  add column if not exists paypal_order_id   text,
  add column if not exists paypal_capture_id text,
  add column if not exists provider          text,
  add column if not exists provider_status   text,
  add column if not exists confirmed_at      timestamptz;

-- Index for webhook/capture lookups by PayPal order ID
create index if not exists donations_paypal_order_idx
  on public.donations (paypal_order_id)
  where paypal_order_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Server-side RPC for PayPal capture (bypasses RLS safely)
--    Called by /api/paypal/capture-order using service_role.
--    Validates that the donation belongs to the correct user and
--    the paypal_order_id matches, then marks it confirmed.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.confirm_paypal_donation(
  p_paypal_order_id   text,
  p_paypal_capture_id text,
  p_provider_status   text,
  p_donor_id          uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donation_id uuid;
begin
  -- Find the pending donation that matches this PayPal order
  select id into v_donation_id
  from public.donations
  where paypal_order_id = p_paypal_order_id
    and donor_id        = p_donor_id
    and status          = 'pending'
  limit 1;

  if v_donation_id is null then
    raise exception 'Donation not found or already processed';
  end if;

  update public.donations
  set
    status            = 'confirmed',
    paypal_capture_id = p_paypal_capture_id,
    provider          = 'paypal',
    provider_status   = p_provider_status,
    confirmed_at      = now()
  where id = v_donation_id;

  return v_donation_id;
end;
$$;

revoke all on function public.confirm_paypal_donation(text, text, text, uuid) from public;
-- Only callable by service_role (API routes). Do not grant to authenticated.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Allow donors to see their confirmed_at and paypal_capture_id
--    (existing "donations read own" policy already covers this via SELECT)
--    No new policies needed — existing policies in supabase-payments.sql
--    cover select/insert by donor and update by platform/church admins.
-- ─────────────────────────────────────────────────────────────────────────────

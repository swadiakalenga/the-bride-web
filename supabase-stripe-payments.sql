-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe Payments Migration
-- Run once in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add stripe_customer_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- 2. User saved payment methods (no raw card data — only metadata from Stripe)
CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id       text        NOT NULL,
  stripe_payment_method_id text        NOT NULL UNIQUE,
  card_brand               text,           -- visa, mastercard, amex, discover, jcb, unionpay
  card_last4               text,
  card_exp_month           integer,
  card_exp_year            integer,
  is_default               boolean     NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_payment_methods_user_idx
  ON public.user_payment_methods (user_id);

-- RLS: users can read and delete their own records; INSERT/UPDATE is service_role only
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own payment methods"   ON public.user_payment_methods;
DROP POLICY IF EXISTS "Users delete own payment methods" ON public.user_payment_methods;

CREATE POLICY "Users view own payment methods"
  ON public.user_payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own payment methods"
  ON public.user_payment_methods FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Add Stripe columns to donations table
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id       text;

CREATE INDEX IF NOT EXISTS donations_stripe_pi_idx
  ON public.donations (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 4. Add a platform-level Stripe payment_settings row if none exists
-- (admin can then enable it via /admin/payments)
INSERT INTO public.payment_settings (owner_type, owner_id, method, enabled, label, config, instructions)
VALUES ('platform', null, 'stripe', false, 'Card (Stripe)', '{}', null)
ON CONFLICT DO NOTHING;

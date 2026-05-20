# Payments Integration Plan

App: TheBride  
Owner: GoldenGroup7 / Stephane Wa Diakalenga  
Last updated: 2026-05-20

> **Status: Planning — no real payment processing implemented yet.**  
> This document defines the full architecture, environment variables, database schema, API routes, and testing checklist for when the payment integration is built.

---

## Goals

1. Let church members donate (tithe / offerings) to their church via the app.
2. Support Stripe (card payments) and PayPal (PayPal balance / card / bank).
3. Give church admins a dashboard showing total donations and individual records.
4. Never store raw card numbers — all sensitive data handled by Stripe/PayPal SDKs.
5. Provide donation receipts via email.

---

## Architecture Overview

```
Browser / Mobile App
        │
        ├─► Stripe.js (client) ─► Stripe servers ─► Webhook ─► /api/webhooks/stripe
        │
        └─► PayPal SDK (client) ─► PayPal servers ─► Webhook ─► /api/webhooks/paypal
                                                            │
                                                            ▼
                                                    Supabase donations table
                                                    SES receipt email
```

- The frontend **never** sees raw card data.
- Server-side API routes create payment intents and verify webhook signatures.
- Supabase stores donation metadata (amount, currency, church, donor, timestamp, status).
- No card data ever touches Supabase.

---

## Database Schema

The schema is already defined in `supabase-payments.sql`. Key tables:

```sql
-- Already in supabase-payments.sql, run that file first

-- donations — one row per completed donation
create table if not exists public.donations (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid references public.churches(id) on delete set null,
  donor_user_id   uuid references public.profiles(id) on delete set null,
  amount_cents    integer not null check (amount_cents > 0),
  currency        text not null default 'usd',
  provider        text not null check (provider in ('stripe', 'paypal')),
  provider_tx_id  text,                    -- Stripe payment_intent id or PayPal capture id
  status          text not null default 'pending'
                    check (status in ('pending', 'completed', 'failed', 'refunded')),
  note            text,                    -- donor's optional message
  is_anonymous    boolean not null default false,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

-- tithing_configs — per-church settings
create table if not exists public.tithing_configs (
  church_id            uuid primary key references public.churches(id) on delete cascade,
  stripe_account_id    text,               -- Stripe Connect account ID (future)
  paypal_email         text,               -- PayPal receiving email
  min_amount_cents     integer default 100,
  max_amount_cents     integer default 1000000,
  currency             text default 'usd',
  enabled              boolean default false,
  updated_at           timestamptz default now()
);
```

### RLS policies for donations
```sql
-- Donors can see their own donations
create policy "donors view own donations"
  on public.donations for select
  using (donor_user_id = auth.uid());

-- Church admins can see donations to their church
create policy "church admin view church donations"
  on public.donations for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = public.donations.church_id
    )
  );

-- Only server-side webhooks insert/update (use service_role from API routes)
-- No direct insert from the client
create policy "no direct client insert"
  on public.donations for insert
  with check (false);
```

---

## API Routes to Build

All routes live under `app/api/`. None exist yet — create them when ready to implement.

### 1. `POST /api/payments/stripe/create-intent`

Creates a Stripe PaymentIntent server-side.

```typescript
// app/api/payments/stripe/create-intent/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { amountCents, currency, churchId, donorUserId, note, isAnonymous } =
    await req.json();

  // Validate inputs
  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: "Minimum donation is $1.00" }, { status: 400 });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency || "usd",
    metadata: { churchId, donorUserId, note: note || "", isAnonymous: String(isAnonymous) },
    automatic_payment_methods: { enabled: true },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
```

### 2. `POST /api/webhooks/stripe`

Receives Stripe events, verifies signature, updates Supabase.

```typescript
// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Use service_role key here — this is server-side only
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // never expose this as NEXT_PUBLIC_
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await supabase.from("donations").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      provider_tx_id: pi.id,
    }).eq("provider_tx_id", pi.id);
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    await supabase.from("donations").update({ status: "refunded" })
      .eq("provider_tx_id", charge.payment_intent);
  }

  return NextResponse.json({ received: true });
}

// Required: disable body parsing so Stripe signature verification works
export const config = { api: { bodyParser: false } };
```

### 3. `POST /api/payments/paypal/create-order`

Creates a PayPal order.

```typescript
// Pseudocode — implement with @paypal/paypal-server-sdk
export async function POST(req: NextRequest) {
  const { amountCents, churchId, donorUserId } = await req.json();
  const amountUsd = (amountCents / 100).toFixed(2);

  const order = await paypalClient.ordersCreate({
    intent: "CAPTURE",
    purchaseUnits: [{
      amount: { currencyCode: "USD", value: amountUsd },
      customId: JSON.stringify({ churchId, donorUserId }),
    }],
  });

  return NextResponse.json({ orderId: order.id });
}
```

### 4. `POST /api/webhooks/paypal`

Receives PayPal IPN events.

```typescript
export async function POST(req: NextRequest) {
  // Verify webhook signature using PayPal SDK
  // On PAYMENT.CAPTURE.COMPLETED → update donations table
  // On PAYMENT.CAPTURE.REFUNDED → update status to 'refunded'
}
```

---

## Frontend Components to Build

None of these exist yet. Build in this order:

### 1. `app/components/payments/DonationModal.tsx`

```
┌─────────────────────────────┐
│  Donate to [Church Name]    │
│  ─────────────────────────  │
│  Amount:  [ $__ ]           │
│  Note:    [____________]    │
│  □ Give anonymously         │
│                             │
│  ┌─ Pay with Card (Stripe) ─┐│
│  │  [Stripe Card Element]  ││
│  └─────────────────────────┘│
│       — or —                │
│  [  PayPal Button  ]        │
│                             │
│  [Donate] [Cancel]          │
└─────────────────────────────┘
```

Props: `churchId`, `churchName`, `onClose`, `onSuccess`.

### 2. `app/components/payments/DonationHistory.tsx`

Table of the current user's past donations (sorted by date desc). Used on the profile page.

### 3. `app/church/[id]/tithe/page.tsx` (exists — extend it)

Currently shows a placeholder. Add:
- `DonationModal` trigger button
- Recent donations list (church admin sees all; members see only their own)
- Church admin total summary row

---

## Environment Variables

```bash
# Public (safe to send to browser)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...   # pk_test_... for dev
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AXxx...

# Private — server API routes only (NEVER NEXT_PUBLIC_)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # used only in webhook handlers, never frontend
PAYPAL_CLIENT_SECRET=Exx...
PAYPAL_WEBHOOK_ID=xxxx
PAYPAL_MODE=sandbox                 # → live when ready
```

---

## Testing Checklist (complete before going live)

### Stripe test mode
- [ ] Create a donation with card `4242 4242 4242 4242`, exp `12/29`, CVC `123`
- [ ] Confirm `donations` row in Supabase has `status = 'completed'`
- [ ] Create a donation with card `4000 0000 0000 9995` (decline) — confirm `status = 'failed'`
- [ ] Trigger a refund from the Stripe dashboard — confirm `status = 'refunded'`
- [ ] Confirm webhook signature validation rejects a tampered payload
- [ ] Confirm minimum amount validation rejects < $1.00
- [ ] Confirm anonymous donations don't show donor name in church admin view

### PayPal sandbox
- [ ] Use a sandbox buyer account from developer.paypal.com
- [ ] Complete a test payment — confirm `donations` row created
- [ ] Confirm PayPal webhook event received at `/api/webhooks/paypal`
- [ ] Confirm refund flow updates status correctly

### Security
- [ ] Confirm `STRIPE_SECRET_KEY` is NOT accessible from the browser (check Network tab)
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is NOT in any `NEXT_PUBLIC_` variable
- [ ] Attempt to call `/api/payments/stripe/create-intent` with an invalid `churchId` — confirm it returns an error, not a payment intent
- [ ] Attempt to insert directly into `donations` table from a browser Supabase client — confirm RLS rejects it

### Amounts
- [ ] Test with minimum amount ($1.00 = 100 cents)
- [ ] Test with large amount ($9,999.99) — confirm Stripe accepts it
- [ ] Test with non-USD currency if needed

---

## Go-live Checklist

- [ ] All test checklist items above pass
- [ ] Stripe account fully activated (live mode unlocked)
- [ ] PayPal account in live mode (`PAYPAL_MODE=live`)
- [ ] All webhook endpoints updated to production URLs
- [ ] `STRIPE_WEBHOOK_SECRET` updated to live webhook secret (different from test)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` updated to `pk_live_` key
- [ ] Donation receipt email tested with real SES
- [ ] Church admin informed how to view donation reports
- [ ] Privacy Policy and Terms of Service mention payment processing
- [ ] Data retention policy documented (how long you keep donation records)

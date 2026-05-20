# Production Accounts Setup

Owner: GoldenGroup7 / Stephane Wa Diakalenga  
App: TheBride — faith-based social platform  
Last updated: 2026-05-20

---

## Overview

This document lists every external service account needed before public launch, the exact environment variables each produces, and the order in which to configure them.

**Do not paste real credentials into this file. Use `.env.local` locally and the Vercel / Capacitor secure variable stores in production.**

---

## 1. Supabase (already active)

### What you have
- Project URL and anon key are in `.env.local`.
- RLS policies are in `supabase-production-rls.sql`.
- Performance indexes are in `supabase-performance-indexes.sql`.
- RPCs are in `supabase-performance-rpcs.sql`.

### Remaining steps
1. In the Supabase dashboard → **Storage** → enable **CDN** for the `media` and `avatars` buckets.
2. In **Auth** → **Email Templates** — customise the confirmation and password-reset emails with TheBride branding.
3. In **Auth** → **URL Configuration** — set **Site URL** to your production domain (e.g. `https://thebride.app`).
4. Add all production domains to **Redirect URLs** (include `https://thebride.app/**` and your Vercel preview URL pattern).
5. In **Database** → **Extensions** — confirm `pgcrypto` and `uuid-ossp` are enabled (required by the migrations).
6. Run the SQL migration files in this order if you have not already:
   ```
   supabase-migration.sql
   supabase-production-rls.sql
   supabase-notification-triggers.sql
   supabase-performance-indexes.sql
   supabase-performance-rpcs.sql
   supabase-payments.sql            ← after Stripe/PayPal are wired
   supabase-read-receipts.sql
   ```
7. Enable **Realtime** for tables: `notifications`, `messages`, `live_streams`.

### Environment variables
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# Never expose service_role key in this Next.js frontend
```

---

## 2. Vercel (web deployment)

### Account setup
1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
2. Framework preset: **Next.js**.
3. Build command: `npm run build`.
4. Install command: `npm install`.
5. Output directory: leave blank (Next.js default).

### Domains
1. In **Settings → Domains** add your production domain (e.g. `thebride.app`).
2. Follow the DNS instructions Vercel provides — typically add a CNAME or A record in Cloudflare.
3. Enable **Automatic HTTPS** (default on Vercel).

### Environment variables to add in Vercel dashboard
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_APP_ENV=production
# Server-side only (not NEXT_PUBLIC_):
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_SECRET=
SENTRY_AUTH_TOKEN=
```

### Checklist
- [ ] Production domain added and DNS propagated
- [ ] All env vars added to **Production** environment (not just Preview)
- [ ] `NEXT_PUBLIC_APP_ENV=production` set so analytics/Sentry only activate in prod
- [ ] Preview deployments use separate Supabase project (recommended) or the same with staging RLS
- [ ] GitHub integration enabled for automatic deploys on push to `main`

---

## 3. Apple Developer Program

### Account setup
1. Go to [developer.apple.com](https://developer.apple.com) → **Enroll** → choose **Organization** (GoldenGroup7).
   - You will need a D-U-N-S number (free via Dun & Bradstreet, takes 3–5 business days).
   - Annual fee: USD $99.
2. Complete two-factor authentication setup for the Apple ID used.

### Certificates and identifiers
1. In **Certificates, Identifiers & Profiles**:
   - Create an **App ID**: `com.goldengroup7.thebride` (or your chosen bundle ID).
   - Enable capabilities: **Push Notifications**, **Sign in with Apple** (optional), **Associated Domains** (for universal links).
2. Create a **Distribution Certificate** (App Store Connect distribution).
3. Create a **Provisioning Profile** (App Store distribution) linked to the App ID and certificate.

### App Store Connect
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. **My Apps** → **+** → **New App** → select iOS, enter:
   - Name: `TheBride`
   - Bundle ID: `com.goldengroup7.thebride`
   - SKU: `thebride-ios-001`
3. Fill in **App Information**, **Pricing**, **App Privacy** labels.
4. Upload screenshots (6.7", 6.1", iPad 12.9" sizes required).
5. Add **App Review Information** — include a test account.

### Push notifications (APNs)
1. In Certificates → **Keys** → create an **Apple Push Notification service (APNs)** key.
2. Download the `.p8` file — store securely, it can only be downloaded once.
3. Note the **Key ID** and your **Team ID**.
4. These are needed when you integrate Capacitor Push later (see `MESSAGING_CALLS_PLAN.md`).

### Environment variables
```bash
# iOS build — set in Xcode / Capacitor config, not in Next.js
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
# APNS .p8 key — store in AWS Secrets Manager, not in version control
```

### Checklist
- [ ] Apple Developer account active with D-U-N-S verified
- [ ] App ID created with Push Notifications capability
- [ ] Distribution certificate created and installed in Xcode
- [ ] APNs key (`.p8`) downloaded and stored securely
- [ ] App Store Connect listing created (can be in draft)

---

## 4. Google Play Console

### Account setup
1. Go to [play.google.com/console](https://play.google.com/console) → sign in with a Google account owned by GoldenGroup7.
2. **Create developer account** → choose **Organization**.
3. One-time registration fee: USD $25.
4. Complete identity verification (may take 24–48 hours).

### App creation
1. **All apps** → **Create app** → enter:
   - App name: `TheBride`
   - Default language: English
   - App type: App
   - Free or paid: Free
2. Complete the **Store listing** (description, screenshots, icon 512×512).
3. Complete **Content rating** questionnaire.
4. Complete **Data safety** form (describe what data you collect and why).
5. Set up **Target audience** (confirm 18+ or general audience policy).

### Signing key
1. In **Setup → App signing** — let Google manage your app signing key (recommended).
2. Download the **upload key** certificate to sign your APK/AAB before upload.
3. Store the upload keystore (`.jks` file) in a secure location — losing it means you cannot update the app.

### Firebase Cloud Messaging (FCM) for Android push
1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Create a project: `TheBride`.
3. Add an Android app with package name `com.goldengroup7.thebride`.
4. Download `google-services.json` → place in `android/app/`.
5. In **Cloud Messaging** → copy the **Server key** (used by your push notification backend).

### Environment variables
```bash
# Android build — stored in android/ Gradle config, not in Next.js
GOOGLE_SERVICES_JSON_PATH=android/app/google-services.json
FCM_SERVER_KEY=          # store in AWS Secrets Manager
```

### Checklist
- [ ] Play Console account active and verified
- [ ] App listing created (draft is fine)
- [ ] Firebase project created, `google-services.json` in `android/app/`
- [ ] Upload keystore generated and backed up to two secure locations
- [ ] Data safety form completed accurately

---

## 5. AWS

See `LIVE_MEDIA_SERVICE_PLAN.md` for the full media pipeline. This section covers general AWS account setup.

### Account setup
1. Go to [aws.amazon.com](https://aws.amazon.com) → **Create an AWS account** under GoldenGroup7.
2. Choose the **Business** account type.
3. Enable **MFA** on the root account immediately.
4. Create an **IAM user** (do not use root credentials for anything):
   - User: `thebride-admin`
   - Attach policy: `AdministratorAccess` (lock this down later to least-privilege).
5. Enable **AWS Cost Alerts** — set a billing alarm at $50/month to avoid surprise charges.
6. Choose region: `us-east-1` (N. Virginia) for lowest latency to Supabase's default region, or whichever is closest to your user base.

### Services you will use
| Service | Purpose |
|---------|---------|
| S3 | Long-term media storage backup, transcoded video output |
| CloudFront | CDN for transcoded video/audio (HLS streams) |
| MediaConvert | Transcode uploaded video to HLS |
| SES | Transactional email (confirmation, password reset) |
| Secrets Manager | Store API keys, `.p8` APNs key, FCM key |
| CloudWatch | Application logs and alerting |

### IAM roles needed (create before services)
```
thebride-mediaconvert-role   — MediaConvert can read S3 input, write S3 output
thebride-ses-role            — SES send permissions for your domain
thebride-app-role            — used by Vercel/Lambda if you add edge functions
```

### Environment variables
```bash
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=thebride-media-prod
AWS_CLOUDFRONT_DOMAIN=https://dXXXXXXX.cloudfront.net
AWS_SES_FROM_ADDRESS=noreply@thebride.app
```

### Checklist
- [ ] AWS account created under GoldenGroup7
- [ ] Root MFA enabled
- [ ] IAM admin user created (no root key usage after this)
- [ ] Billing alarm configured
- [ ] Secrets Manager set up for sensitive keys
- [ ] S3 bucket `thebride-media-prod` created with versioning enabled

---

## 6. Stripe

**Do not activate real payments until the Stripe integration is fully tested end-to-end in test mode.** See `PAYMENTS_INTEGRATION_PLAN.md`.

### Account setup
1. Go to [stripe.com](https://stripe.com) → **Start now**.
2. Business name: GoldenGroup7 (or TheBride if registering the brand).
3. Business type: likely **Individual** or **Private company** depending on entity structure.
4. Complete identity verification (government ID required for the account owner).
5. Add your bank account for payouts.
6. In **Settings → Business** → set your **Statement descriptor**: `THEBRIDE`.
7. In **Settings → Tax** — if collecting in the US, configure tax ID.

### Test mode vs live mode
- All development and QA uses **test mode** (keys starting with `sk_test_`).
- Only switch to **live mode** after completing Stripe's activation checklist.
- Stripe test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (decline).

### Webhooks
1. In **Developers → Webhooks** → **Add endpoint**.
2. URL: `https://thebride.app/api/webhooks/stripe`.
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.subscription.created` (if subscriptions added later)
4. Copy the **Webhook signing secret** — add to `STRIPE_WEBHOOK_SECRET`.

### Environment variables
```bash
# Public (safe to expose to browser)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Private — server-side only, never NEXT_PUBLIC_
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Test mode equivalents (use in .env.local)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Checklist
- [ ] Stripe account created and identity verified
- [ ] Bank account added for payouts
- [ ] Webhook endpoint registered for production URL
- [ ] Test mode confirmed working (see `PAYMENTS_INTEGRATION_PLAN.md`)
- [ ] Live mode activated only after successful end-to-end test

---

## 7. PayPal Business

**Same rule as Stripe — do not process real money until test suite passes.**

### Account setup
1. Go to [paypal.com/bizsignup](https://www.paypal.com/bizsignup).
2. Choose **Business account**.
3. Business name: GoldenGroup7.
4. Complete identity verification.
5. Link your bank account.

### Developer / sandbox setup
1. Go to [developer.paypal.com](https://developer.paypal.com).
2. **Log in with your PayPal Business account**.
3. **My Apps & Credentials** → **Create App** → name it `TheBride`.
4. Copy **Client ID** and **Secret** from the **Sandbox** tab for development.
5. Copy **Client ID** and **Secret** from the **Live** tab for production.

### Webhooks
1. In **My Apps & Credentials** → select your app → **Webhooks** → **Add webhook**.
2. URL: `https://thebride.app/api/webhooks/paypal`.
3. Events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`

### Environment variables
```bash
# Public
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AXxx...   # sandbox for dev, live for prod

# Server-side only
PAYPAL_CLIENT_SECRET=Exx...
PAYPAL_WEBHOOK_ID=xxxx                  # from webhook registration
PAYPAL_MODE=sandbox                     # change to 'live' for production
```

### Checklist
- [ ] PayPal Business account verified
- [ ] Developer app created with sandbox credentials
- [ ] Sandbox buyer/seller test accounts created in the PayPal sandbox
- [ ] Webhook registered for production URL
- [ ] Live credentials saved securely (AWS Secrets Manager)

---

## 8. Email Provider (AWS SES — recommended)

TheBride currently uses Supabase's built-in email for auth flows. SES adds custom transactional email (prayer confirmations, donation receipts, etc.) and removes Supabase's email rate limits.

### SES setup
1. In the AWS console → **Amazon SES** → **Verified identities** → **Create identity**.
2. Choose **Domain** → enter `thebride.app`.
3. SES will provide DNS records — add them in Cloudflare (DKIM CNAME records + SPF TXT record).
4. Wait for verification (usually under 10 minutes once DNS propagates).
5. In **Configuration sets** → create `thebride-prod` for tracking opens/bounces.
6. Request **production access** (exits sandbox) — SES starts in sandbox, limiting sends to verified addresses only. Submit the production request form; AWS typically approves in 24 hours.

### Supabase custom SMTP
1. In Supabase dashboard → **Auth** → **SMTP Settings** → enable.
2. Host: `email-smtp.us-east-1.amazonaws.com`
3. Port: `587`
4. Username: IAM SMTP credentials (created separately from IAM access keys in SES console).
5. Password: IAM SMTP password.
6. Sender name: `TheBride`
7. Sender email: `noreply@thebride.app`

### Environment variables
```bash
AWS_SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
AWS_SES_SMTP_PORT=587
AWS_SES_SMTP_USER=AKIAXXXXXXXXXXXXXXXX
AWS_SES_SMTP_PASS=BXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AWS_SES_FROM_ADDRESS=noreply@thebride.app
```

### Checklist
- [ ] `thebride.app` domain verified in SES
- [ ] DKIM records added in Cloudflare and verified
- [ ] SPF TXT record added (`v=spf1 include:amazonses.com ~all`)
- [ ] DMARC TXT record added (`v=DMARC1; p=quarantine; rua=mailto:dmarc@thebride.app`)
- [ ] SES production access approved (out of sandbox)
- [ ] Supabase SMTP updated to use SES
- [ ] Test email sent from Supabase auth to a real inbox

---

## 9. Cloudflare

### Account setup
1. Go to [cloudflare.com](https://cloudflare.com) → **Sign Up** → add your domain `thebride.app`.
2. Select the **Free** plan (sufficient for DNS, DDoS protection, and basic CDN).
3. Cloudflare will display nameservers — update them at your domain registrar.
4. Wait for nameserver propagation (up to 24 hours, usually under 1 hour).

### DNS records to add
| Type | Name | Value | Notes |
|------|------|-------|-------|
| CNAME | `@` | `cname.vercel-dns.com` | Vercel web app |
| CNAME | `www` | `cname.vercel-dns.com` | www redirect |
| TXT | `@` | SPF record from SES | Email authentication |
| CNAME | `s1._domainkey` | DKIM value from SES | Email DKIM |
| CNAME | `s2._domainkey` | DKIM value from SES | Email DKIM |
| TXT | `_dmarc` | DMARC policy | Email security |

### Security settings
1. **SSL/TLS** → set to **Full (strict)** — Vercel and SES both serve valid certificates.
2. **Security** → **WAF** → enable **Managed Rules** (free tier includes OWASP rules).
3. **Security** → **Bot Fight Mode** → enable.
4. **Speed** → **Minification** → enable HTML/CSS/JS (complements Next.js output).
5. **Caching** → **Browser Cache TTL** → set to **4 hours** for static assets.
6. **Page Rules** (or Transform Rules):
   - `thebride.app/api/*` → Cache Level: Bypass (never cache API responses)
   - `thebride.app/storage/*` → Cache Level: Cache Everything, Edge TTL: 1 day

### Checklist
- [ ] Domain transferred to Cloudflare nameservers
- [ ] All DNS records added (verify with `dig thebride.app`)
- [ ] SSL mode set to Full (strict)
- [ ] WAF managed rules enabled
- [ ] API paths exempted from cache
- [ ] Bot Fight Mode enabled

---

## 10. Sentry (Error Monitoring)

### Account setup
1. Go to [sentry.io](https://sentry.io) → **Get started** → create an organisation: `GoldenGroup7`.
2. Create a project → Platform: **Next.js** → name it `thebride-web`.
3. Copy the **DSN** (Data Source Name).
4. Create a second project for **React Native / Capacitor** → name it `thebride-mobile`.

### Next.js integration
Install the SDK (already should be in package.json — verify):
```bash
npm install @sentry/nextjs
```

Create `sentry.client.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || "development",
  tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === "production" ? 0.1 : 1.0,
  // Only report errors in production to avoid noise
  enabled: process.env.NEXT_PUBLIC_APP_ENV === "production",
});
```

Create `sentry.server.config.ts` and `sentry.edge.config.ts` (same content, different scope). Add to `next.config.ts`:
```typescript
import { withSentryConfig } from "@sentry/nextjs";
export default withSentryConfig(nextConfig, {
  org: "goldengroup7",
  project: "thebride-web",
  silent: true,
});
```

### Source maps
1. In Sentry → **Settings → Projects → thebride-web → Source Maps** → generate an auth token.
2. Add `SENTRY_AUTH_TOKEN` to Vercel env vars so source maps upload on each deploy.

### Alerts
1. In Sentry → **Alerts** → create:
   - **Error rate spike**: alert when error rate > 10/min for 5 minutes → email + Slack.
   - **New issue**: alert on first occurrence of any new error → email.
   - **Performance degradation**: P95 response > 3s for `/api/*` → email.

### Environment variables
```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@oXXX.ingest.sentry.io/XXXXX
SENTRY_AUTH_TOKEN=         # server-side only — for source map uploads
SENTRY_ORG=goldengroup7
SENTRY_PROJECT=thebride-web
```

### Checklist
- [ ] Sentry org and project created
- [ ] `@sentry/nextjs` installed and configured
- [ ] Source maps uploading on Vercel deploys
- [ ] Error alerts configured (email minimum)
- [ ] Test by intentionally throwing an error in dev, confirm it appears in Sentry

---

## 11. Analytics (Google Analytics 4)

### Account setup
1. Go to [analytics.google.com](https://analytics.google.com).
2. **Admin** → **Create Account** → name: `GoldenGroup7`.
3. **Create Property** → name: `TheBride Web` → select **Web**.
4. Copy the **Measurement ID** (`G-XXXXXXXXXX`).
5. Create a second property for **TheBride Mobile** (Android/iOS).

### Next.js integration

Install (or verify installed):
```bash
npm install @next/third-parties
```

In `app/layout.tsx`:
```typescript
import { GoogleAnalytics } from "@next/third-parties/google";

// Inside <html> body, after children:
{process.env.NEXT_PUBLIC_APP_ENV === "production" && (
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!} />
)}
```

### Key events to track (add progressively)
| Event | When to fire |
|-------|-------------|
| `sign_up` | After successful registration |
| `login` | After successful login |
| `create_post` | After post published |
| `share_post` | After share |
| `join_church` | After church membership approved |
| `donation_initiated` | When payment modal opens |
| `donation_completed` | After payment_intent.succeeded |

### Privacy compliance
- Add a cookie consent banner before firing analytics (required for GDPR in EU).
- Add a Privacy Policy link in the app footer pointing to `/legal/privacy`.
- Do not track authenticated user IDs directly — use GA4's anonymous client ID.

### Environment variables
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Checklist
- [ ] GA4 property created
- [ ] Measurement ID added to Vercel env vars
- [ ] `GoogleAnalytics` component added to layout (production-gated)
- [ ] Verify real-time view in GA4 shows page views after deploy
- [ ] Cookie consent banner added (at minimum for EU users)

---

## Master Environment Variables Reference

Below is every env var across all services. Copy this block, fill it out in `.env.local` for local development, and mirror all values in Vercel's **Production** environment settings.

```bash
# ─── Supabase ─────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ─── App environment ──────────────────────────────────────
NEXT_PUBLIC_APP_ENV=production          # or development / staging

# ─── Stripe ───────────────────────────────────────────────
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ─── PayPal ───────────────────────────────────────────────
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_MODE=sandbox                     # change to live for production

# ─── AWS ──────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=thebride-media-prod
AWS_CLOUDFRONT_DOMAIN=
AWS_SES_FROM_ADDRESS=noreply@thebride.app

# ─── Email / SES SMTP ─────────────────────────────────────
AWS_SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
AWS_SES_SMTP_PORT=587
AWS_SES_SMTP_USER=
AWS_SES_SMTP_PASS=

# ─── Sentry ───────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=goldengroup7
SENTRY_PROJECT=thebride-web

# ─── Analytics ────────────────────────────────────────────
NEXT_PUBLIC_GA_MEASUREMENT_ID=

# ─── Mobile (not Next.js — used in Capacitor/native builds)
APPLE_TEAM_ID=
APPLE_KEY_ID=
# FCM_SERVER_KEY → store in AWS Secrets Manager only
```

---

## Security Rules Summary

1. **Never** commit `.env.local` or any file containing real keys to git.
2. **Never** add a `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` as a `NEXT_PUBLIC_` variable.
3. Rotate all keys immediately if accidentally pushed to a public repository.
4. Use **AWS Secrets Manager** for APNs `.p8` file, FCM server key, and any key that cannot be stored as a plain env var.
5. Limit IAM permissions to the minimum required (least-privilege) before going to production.
6. Enable **Cloudflare WAF** before exposing the app publicly.
7. Review Supabase RLS policies (`supabase-production-rls.sql`) and test with a non-admin account before launch.

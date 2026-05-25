# TheBride — Analytics & Observability Setup

This document covers how to layer external analytics and observability tools on top of the built-in `analytics_events` table.

---

## Built-in analytics (live now)

TheBride ships with a lightweight first-party event log:

| Component | Location |
|-----------|----------|
| SQL schema | `supabase-analytics-events.sql` |
| Client helper | `lib/analytics/trackEvent.ts` |
| Admin dashboard | `/admin/analytics` |

### Events tracked out of the box

| Event type | Fired when |
|-----------|-----------|
| `login` | Password or OTP login succeeds |
| `post_create` | New post published to feed |
| `post_like` | Post liked (not unliked) |
| `comment_create` | Comment submitted |
| `message_send` | Direct message sent |
| `follow_user` | User followed (not unfollowed) |
| `follow_church` | Church followed |
| `donation_completed` | Stripe payment succeeds |
| `live_start` | Church admin starts a livestream |
| `live_join` | Viewer loads a live page |
| `support_ticket_created` | Support ticket submitted |

### Adding new events

```typescript
import { trackEvent } from "@/lib/analytics/trackEvent";

// Anywhere in a client component — never throws, fire-and-forget
trackEvent("post_create", { church_id: "uuid-here" });
```

---

## Phase 6 — Vercel Analytics

Vercel Analytics provides page-view and Web Vitals data with zero backend work.

### Setup

1. **Enable in Vercel dashboard**
   - Go to your project → **Analytics** tab → Enable
   - No code changes needed for page views

2. **Install the package** (for React component & `track()` API)

   ```bash
   npm install @vercel/analytics
   ```

3. **Add the Analytics component** to `app/layout.tsx`:

   ```tsx
   import { Analytics } from "@vercel/analytics/react";
   
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           {children}
           <Analytics />
         </body>
       </html>
     );
   }
   ```

4. **Add Speed Insights** (Core Web Vitals):

   ```bash
   npm install @vercel/speed-insights
   ```

   ```tsx
   import { SpeedInsights } from "@vercel/speed-insights/next";
   // Add <SpeedInsights /> next to <Analytics />
   ```

5. **Custom events** (optional, enriches Vercel data):

   ```tsx
   import { track } from "@vercel/analytics";
   track("donation_completed", { amount_usd: 25 });
   ```

### Cost / privacy

- Free tier: up to 2,500 events/month
- No cookie banner needed — Vercel Analytics is cookieless
- Data stays in Vercel infrastructure

---

## Phase 7 — Sentry (Error Monitoring)

Sentry catches unhandled JS errors, slow API routes, and performance regressions.

### Why

- The app has complex async flows (Stripe webhooks, Supabase RLS, Mux live) — silent errors are easy to miss
- Sentry surfaces errors with full stack traces + user context

### Setup

1. **Create a Sentry project** at sentry.io → New Project → Next.js

2. **Install**:

   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```

   This auto-creates `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`.

3. **Required environment variables**:

   ```env
   SENTRY_DSN=https://xxxxxxxx@oxxxxxxxx.ingest.sentry.io/xxxxxxxx
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=your-project-slug
   SENTRY_AUTH_TOKEN=sntrys_xxxx   # for source map uploads (CI only)
   NEXT_PUBLIC_SENTRY_DSN=https://...   # same DSN, client-side
   ```

4. **Redact PII** — add to `sentry.client.config.ts`:

   ```typescript
   Sentry.init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     beforeSend(event) {
       // Strip user emails from error events
       if (event.user) delete event.user.email;
       return event;
     },
   });
   ```

5. **Verify**: Trigger a test error → confirm it appears in Sentry dashboard

### Cost / privacy

- Free tier: 5,000 errors/month
- GDPR: enable "Data Scrubbing" in Sentry project settings
- Do NOT log message content, user names, or payment details in error metadata

---

## Phase 8 — Session Replay (Clarity / PostHog)

Session replay lets you watch anonymised user journeys to identify UX friction.

> ⚠️ **Prerequisite**: Update your Privacy Policy to disclose session recording before enabling any replay tool.

### Option A — Microsoft Clarity (free, no event limit)

1. Create account at clarity.microsoft.com → New Project → Next.js

2. Add tracking snippet to `app/layout.tsx`:

   ```tsx
   import Script from "next/script";
   
   // Inside <body>:
   <Script id="clarity" strategy="afterInteractive">
     {`(function(c,l,a,r,i,t,y){
       c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
       t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
       y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
     })(window,document,"clarity","script","YOUR_PROJECT_ID");`}
   </Script>
   ```

3. **Mask sensitive fields** in Clarity dashboard → Settings → Masking
   - Mask: password fields, card inputs, message content areas

### Option B — PostHog (open source, self-hostable)

1. Install:

   ```bash
   npm install posthog-js
   ```

2. Initialize in `app/layout.tsx` (client component):

   ```tsx
   import posthog from "posthog-js";
   import { PostHogProvider } from "posthog-js/react";
   
   if (typeof window !== "undefined") {
     posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
       api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
       capture_pageview: true,
       session_recording: {
         maskAllInputs: true,           // hides all text inputs
         maskTextSelector: "[data-mask]" // add to sensitive elements
       },
     });
   }
   ```

3. **Required env vars**:

   ```env
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxx
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com  # or your self-hosted URL
   ```

4. **Privacy**: PostHog can be self-hosted on your own infra — ideal for GDPR compliance if your users are in the EU.

---

## Recommended rollout order

| Priority | Tool | Effort | Benefit |
|----------|------|--------|---------|
| 1 ✅ | Built-in `analytics_events` | Done | First-party event log |
| 2 | Vercel Analytics | 15 min | Page views + Web Vitals |
| 3 | Sentry | 30 min | Error tracking, crash reports |
| 4 | Clarity or PostHog | 45 min | Session replay (after privacy policy update) |

---

*Last updated: 2026-05-25*

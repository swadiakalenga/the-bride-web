# TheBride — Push Notifications Setup

Universal mobile push notifications for TheBride Android (and iOS) APK.
Architecture: notification row inserted → Vercel API route → FCM → device.

---

## How it works

```
User action (send message, follow, approve membership, ...)
  ↓
createNotification()  [lib/notificationPush.ts]
  ↓  1. INSERT into notifications table
  ↓  2. look up actor display name (for personalised push body)
  ↓  3. fetch POST /api/push/send  { user_id, title, body, data }
         ↓
         Vercel API route  [app/api/push/send/route.ts]
           ↓  verify caller JWT (Supabase session)
           ↓  query device_push_tokens WHERE user_id = recipient AND enabled = true
           ↓  POST to FCM v1 API for each token
           ↓  delete stale/unregistered tokens automatically
```

Push registration happens inside `PushNotificationInit` (mounted in `app/layout.tsx`).
On first native-app launch the OS permission dialog is shown; token is saved to
`device_push_tokens` in Supabase.

> **No Supabase Edge Function needed.** The push sender runs as a Vercel API route
> alongside the rest of the Next.js app. Firebase credentials are Vercel env vars.

---

## Step 1 — Firebase project

1. Go to https://console.firebase.google.com
2. Create a project (or open an existing one)
3. Name it something like **TheBride**

---

## Step 2 — Register the Android app

1. In Firebase console → **Project settings** → **Your apps** → **Add app** → Android
2. Android package name: `com.goldengroup7.thebride` (must match `capacitor.config.ts`)
3. Download **`google-services.json`**
4. Place it at: `android/app/google-services.json`

The `android/app/build.gradle` already detects this file and automatically applies
the Google Services plugin — no further Gradle changes needed.

---

## Step 3 — Enable FCM

FCM is enabled by default for all Firebase projects. Verify it under:
**Project settings → Cloud Messaging → Firebase Cloud Messaging API (V1)** — must show **Enabled**.

---

## Step 4 — Create a service account key

The Vercel API route uses the FCM **HTTP v1 API** (not the deprecated legacy API).
It requires a Google service account key.

1. Firebase console → **Project settings** → **Service accounts**
2. Click **Generate new private key** → download the JSON file
3. From the JSON extract these three fields:
   - `project_id`
   - `client_email`
   - `private_key`

---

## Step 5 — Add Vercel environment variables

In Vercel dashboard → **Project → Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `FIREBASE_PROJECT_ID` | Firebase project ID (e.g. `thebride-12345`) |
| `FIREBASE_CLIENT_EMAIL` | Service account `client_email` from JSON key |
| `FIREBASE_PRIVATE_KEY` | Service account `private_key` from JSON key |

> **Important for `FIREBASE_PRIVATE_KEY`:** Paste the full PEM value including
> `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. Vercel preserves
> the real newlines, so the route's `.replace(/\\n/g, "\n")` call correctly
> normalises both literal-`\n` and real-newline variants.

For local development, add them to `.env.local`:
```
FIREBASE_PROJECT_ID=thebride-12345
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@thebride-12345.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

The three Firebase variables join the existing server-side env vars already needed:
- `SUPABASE_SERVICE_ROLE_KEY` — already required by Stripe API routes; reused by the push route

---

## Step 6 — Run the SQL migration

In Supabase **SQL editor**, run:

```
supabase-push-notifications.sql
```

This creates `device_push_tokens` with RLS policies.

---

## Step 7 — Deploy to Vercel

The push route is a standard Next.js API route — it deploys automatically with
`git push` to your Vercel project. No separate deploy step needed.

```bash
npm run build          # verify locally
git push               # Vercel picks it up
```

The route lives at: `https://the-bride-web.vercel.app/api/push/send`

---

## Step 8 — Sync Capacitor and rebuild APK

```bash
npx cap sync android   # copy web build + apply Android plugin changes

# Open in Android Studio and build the APK
npx cap open android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

---

## Step 9 — Android notification channel (optional but recommended)

For Android 8+ (API 26+) define a notification channel so users can control
sound/vibration in Settings.

Add to `android/app/src/main/res/values/strings.xml`:
```xml
<string name="default_notification_channel_id">thebride_notifications</string>
<string name="default_notification_channel_name">TheBride Notifications</string>
```

The API route already sets `channel_id: "thebride_notifications"` on the Android
FCM payload. Capacitor's push plugin creates the channel automatically.

---

## Testing checklist

### Device registration
- [ ] Install APK on Android device
- [ ] Open app and sign in
- [ ] Accept notification permission dialog
- [ ] In Supabase table editor: verify a row appears in `device_push_tokens`
      with your `user_id`, `platform = 'android'`, and `enabled = true`

### Push delivery
- [ ] From another account: send a message → recipient gets "New message" push
- [ ] From another account: follow the user → recipient gets "New follower" push
- [ ] Approve a church membership → member gets "Membership approved" push
- [ ] Approve church verification in admin → church admin gets "Church verified ✓" push

### Deep links (notification tap)
- [ ] Tap message notification → opens `/messages/[conversationId]`
- [ ] Tap church notification → opens `/church/[churchId]`
- [ ] Tap post notification → opens `/post/[postId]`
- [ ] Tap any other notification → opens `/notifications`

### Token cleanup
- [ ] Sign out → `device_push_tokens.enabled` set to `false` for your user
- [ ] Re-sign in → token re-enabled (upsert on login)
- [ ] Reinstall app with new FCM token → old token removed from DB (UNREGISTERED cleanup)

### Firebase not configured (graceful degradation)
- [ ] Without Firebase env vars set: push returns `{ sent: 0, reason: "firebase_not_configured" }`
      — app continues to work, notifications persist in DB, no crash

---

## Vercel environment variables required

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key (full PEM) |
| `SUPABASE_SERVICE_ROLE_KEY` | Already needed — reused by push route |

---

## Android changes required

| File | Change |
|------|--------|
| `android/app/google-services.json` | Downloaded from Firebase (not committed — add to .gitignore) |
| `android/app/src/main/AndroidManifest.xml` | `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` (already added) |
| `capacitor.config.ts` | `plugins.PushNotifications.presentationOptions` (already added) |

---

## Notification types supported (17 types)

| Type | Title | Body |
|------|-------|------|
| `message` | New message | {name} sent you a message |
| `message_request` | Message request | {name} sent you a message request |
| `follow` | New follower | {name} started following you |
| `like` | New like | {name} liked your post |
| `comment` | New comment | {name} commented on your post |
| `reply` | New reply | {name} replied to your comment |
| `tag` | Mentioned | {name} mentioned you in a post |
| `prayer` | Prayer | {name} prayed for your request |
| `event` | New event | New event in your church |
| `membership_request` | Membership request | {name} wants to join your church |
| `membership_approved` | Membership approved | Your membership request was approved |
| `membership_rejected` | Membership update | Your membership request was not approved |
| `church_verified` | Church verified ✓ | Your church has been verified |
| `church_rejected` | Verification update | Your church verification was not approved |
| `donation_received` | Donation received | {name} made a donation |
| `tithe_received` | Tithe received | {name} gave their tithe |
| `offering_received` | Offering received | {name} gave an offering |

---

## Adding new notification types in the future

1. Add the type to `buildPushPayload()` in [`lib/notificationPush.ts`](../lib/notificationPush.ts)
2. Call `createNotification({ type: "my_new_type", ... })` in the app
3. Add a deep-link rule in [`lib/pushNotifications.ts`](../lib/pushNotifications.ts) if needed

No other changes needed — the pipeline is fully driven by `createNotification()`.

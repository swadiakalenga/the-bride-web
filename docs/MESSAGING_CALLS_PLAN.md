# Messaging & Calls Plan

App: TheBride  
Owner: GoldenGroup7 / Stephane Wa Diakalenga  
Last updated: 2026-05-20

> **Status: Planning — voice/video calls not implemented yet.**  
> Text messaging and media messaging exist and work. This document covers push notifications for messages and the future calls feature.

---

## Current State of Messaging

### What works
- One-to-one text conversations (`conversations` + `messages` tables).
- Media attachments in messages (image, audio, video via Supabase Storage).
- Message requests (non-followers must be approved before messaging).
- Read receipts (`is_read`, `read_at` columns + `supabase-read-receipts.sql`).
- Realtime delivery via Supabase Realtime (`messages` channel).
- Cursor-based pagination — latest 50 messages loaded, "Load earlier" button for older.
- Unread count via `get_conversation_list` RPC.

### What is missing
- **Push notifications** — messages only appear if the app is open (Realtime). If the app is in the background or closed, the user sees nothing.
- **Voice calls** — no implementation.
- **Video calls** — no implementation.
- **Group messaging** — no implementation (conversations are 1:1 only).

---

## Phase 1 — Push Notifications for Messages

### Architecture

```
New message inserted into Supabase messages table
         │
         ▼
Supabase pg_net / Edge Function triggered
(or Postgres notification_triggers.sql trigger → sends HTTP to Edge Function)
         │
         ▼
Edge Function reads recipient's push token from profiles table
         │
         ├─► iOS: APNs (Apple Push Notification service)
         └─► Android: FCM (Firebase Cloud Messaging)
                │
                ▼
         Device receives push notification
         "New message from [Sender]"
         Tap → opens app to /messages/{conversationId}
```

### Database additions needed

```sql
-- Add push token storage to profiles
alter table public.profiles
  add column if not exists push_token       text,
  add column if not exists push_platform    text check (push_platform in ('ios', 'android', 'web')),
  add column if not exists push_enabled     boolean not null default true,
  add column if not exists push_token_updated_at timestamptz;

-- Index for token lookups
create index if not exists idx_profiles_push_token
  on public.profiles(push_token) where push_token is not null;
```

### Capacitor Push Notification setup

Install the Capacitor plugin (when building the mobile app):
```bash
npm install @capacitor/push-notifications
npx cap sync
```

Register token in `app/layout.tsx` or a dedicated `lib/pushNotifications.ts`:

```typescript
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";

export async function registerPushToken() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    // Detect platform: Capacitor.getPlatform() → 'ios' | 'android'
    const platform = (await import("@capacitor/core")).Capacitor.getPlatform();
    await supabase.from("profiles").update({
      push_token: token.value,
      push_platform: platform === "ios" ? "ios" : "android",
      push_token_updated_at: new Date().toISOString(),
    }).eq("id", authData.user!.id);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
    const conversationId = notification.notification.data?.conversationId;
    if (conversationId) {
      window.location.href = `/messages/${conversationId}`;
    }
  });
}
```

### Edge Function: `send-push-notification`

Deploy as a Supabase Edge Function:

```typescript
// supabase/functions/send-push-notification/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  const { recipientUserId, senderName, messagePreview, conversationId } =
    await req.json();

  // Look up recipient's push token from Supabase using service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await supabase
    .from("profiles")
    .select("push_token, push_platform, push_enabled")
    .eq("id", recipientUserId)
    .maybeSingle();

  if (!profile?.push_token || !profile.push_enabled) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  if (profile.push_platform === "ios") {
    await sendApns(profile.push_token, senderName, messagePreview, conversationId);
  } else {
    await sendFcm(profile.push_token, senderName, messagePreview, conversationId);
  }

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});
```

### Supabase trigger to call Edge Function

```sql
-- Add to supabase-notification-triggers.sql or a new file
create or replace function public.trigger_push_for_new_message()
returns trigger language plpgsql security definer as $$
begin
  -- Only push if message is not from recipient (avoids self-push)
  if new.sender_id != (
    select user_id from conversation_participants
    where conversation_id = new.conversation_id
      and user_id != new.sender_id
    limit 1
  ) then
    perform net.http_post(
      url := current_setting('app.supabase_functions_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'recipientUserId', (
          select user_id from conversation_participants
          where conversation_id = new.conversation_id
            and user_id != new.sender_id
          limit 1
        ),
        'senderName', new.sender_id,
        'messagePreview', left(new.content, 80),
        'conversationId', new.conversation_id
      )
    );
  end if;
  return new;
end;
$$;

create trigger push_on_new_message
  after insert on public.messages
  for each row execute function public.trigger_push_for_new_message();
```

### iOS APNs configuration

1. In `ios/App/App/` → open `AppDelegate.swift`.
2. Add APNs registration code (Capacitor handles most of this automatically).
3. In Xcode → **Signing & Capabilities** → add **Push Notifications** capability.
4. In Xcode → **Signing & Capabilities** → add **Background Modes** → check **Remote notifications**.
5. Use the `.p8` key (downloaded from Apple Developer) in your Edge Function to sign APNs requests (JWT-based auth — preferred over certificate-based).

### Android FCM configuration

1. Confirm `google-services.json` is in `android/app/`.
2. In `android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
3. Capacitor Push plugin handles the rest automatically.

### Environment variables (Edge Function secrets)

```bash
# Set via Supabase Dashboard → Settings → Edge Functions → Secrets
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=XXXXXXXXXX
APNS_BUNDLE_ID=com.goldengroup7.thebride
APNS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...  # contents of .p8 file
FCM_SERVER_KEY=AAAA...   # from Firebase Console
```

---

## Phase 2 — Voice & Video Calls

> **Not implementing now. Planned for a future release.**

### Recommended service: Daily.co or Agora

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Daily.co** | Simple REST API, works in browsers + Capacitor | ~$0.004/min/participant | Medium |
| **Agora** | Native SDK, very low latency | More complex setup | ~$0.0015/min/participant |
| **LiveKit** | Open source, self-hostable | Requires own server | Hosting cost only |
| **Twilio Video** | Well-documented | More expensive | ~$0.004/min/participant |

**Recommendation**: Daily.co for the first version (fastest to integrate), switch to LiveKit when you want self-hosted control.

### Call flow (Daily.co sketch)

```
Caller taps "Call" button on a conversation
         │
         ▼
POST /api/calls/create-room
  → Daily.co API: create room with 5-minute expiry
  → Returns: roomUrl, participantToken
         │
         ▼
Supabase Realtime: insert a call_invitations row
  → Recipient's app sees the insert via Realtime subscription
  → Shows an incoming call UI (ring tone + accept/reject)
         │
         ▼
Both parties join the Daily.co room URL
  → in-app using Daily.co's <DailyProvider> React component
         │
         ▼
On hang up: DELETE the room via Daily.co API
  → update call_invitations.status = 'ended'
```

### Database additions needed (for Phase 2)

```sql
create table if not exists public.call_invitations (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid references public.conversations(id) on delete cascade,
  caller_id         uuid references public.profiles(id) on delete cascade,
  callee_id         uuid references public.profiles(id) on delete cascade,
  room_url          text,
  status            text not null default 'ringing'
                      check (status in ('ringing', 'accepted', 'rejected', 'ended', 'missed')),
  call_type         text not null default 'voice' check (call_type in ('voice', 'video')),
  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz not null default now()
);

-- Realtime must be enabled on this table for incoming call push
```

### UI components to build (Phase 2)

- `app/components/messaging/IncomingCallModal.tsx` — ring modal with accept/reject
- `app/components/messaging/CallScreen.tsx` — full-screen call UI (mute, camera flip, hang up)
- `app/messages/[id]/page.tsx` — add call icon button in the header

---

## Phase 3 — Group Messaging

> **Not implementing now. Lower priority than calls.**

### Changes needed
- Add a `group_conversations` table (name, avatar, admin_user_id).
- Add a `group_participants` table.
- Update `messages` to support `group_conversation_id` as an alternative to `conversation_id`.
- New group conversation creation UI.
- Group mention (`@username`) parsing in message content.

---

## Environment Variables Summary

```bash
# Push notifications (Supabase Edge Function secrets — not Next.js)
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=com.goldengroup7.thebride
APNS_PRIVATE_KEY=         # .p8 file contents, escaped

FCM_SERVER_KEY=           # from Firebase Cloud Messaging

# Phase 2 — Calls (add when implementing)
DAILY_API_KEY=            # from Daily.co dashboard
NEXT_PUBLIC_DAILY_DOMAIN= # e.g. thebride.daily.co
```

---

## Testing Checklist

### Push notifications
- [ ] Install app on a real iOS device — confirm `push_token` saved to `profiles`
- [ ] Install app on a real Android device — confirm `push_token` saved to `profiles`
- [ ] Send a message while the recipient's app is **backgrounded** — confirm push notification appears
- [ ] Send a message while the recipient's app is **closed** — confirm push notification appears
- [ ] Tap the push notification — confirm app opens to the correct conversation
- [ ] User with `push_enabled = false` does not receive notifications
- [ ] User that uninstalls the app → stale token handled gracefully (FCM/APNs return 410 → delete token)

### Message delivery
- [ ] Message appears instantly via Realtime when app is foreground
- [ ] Read receipt updates when recipient opens the conversation
- [ ] Unread count decrements when conversation is opened

---

## Security Notes

1. Push tokens are PII — protect with RLS: only the owning user and server-side functions can read tokens.
2. The Edge Function uses `service_role_key` which bypasses RLS — scope it tightly (only reads `push_token` column from `profiles`).
3. Never log full message content in CloudWatch / Sentry — truncate to 20 chars max.
4. All call room URLs expire after 5 minutes (set on Daily.co room creation) — prevents link sharing.
5. Block calls from users who are blocked by the recipient (check `blocked_users` table before creating room).

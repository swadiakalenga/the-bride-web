# Mux Live Stream Setup — TheBride

TheBride uses [Mux](https://mux.com) to power church live streams.
This document covers everything needed to get live streams working end-to-end.

---

## 1. Get your Mux credentials

1. Log in at [https://dashboard.mux.com](https://dashboard.mux.com)
2. Go to **Settings → Access Tokens**
3. Click **Generate new token**
4. Select environment: **Production** (or Sandbox for testing)
5. Permissions needed: **Mux Video — Full Access**
6. Copy:
   - **Token ID** → `MUX_TOKEN_ID`
   - **Token Secret** → `MUX_TOKEN_SECRET`

> These are server-only secrets. Never paste them anywhere client-side or commit them to git.

---

## 2. Add environment variables

### Vercel (production)

1. Open your Vercel project → **Settings → Environment Variables**
2. Add both variables for **Production** and **Preview**:

| Variable | Value |
|----------|-------|
| `MUX_TOKEN_ID` | your token ID from above |
| `MUX_TOKEN_SECRET` | your token secret from above |

3. **Redeploy** after adding env vars (Vercel requires a new deploy to pick them up).

### Local development (`.env.local`)

Add to `/Users/swadiakalenga/the-bride-web/.env.local`:

```bash
MUX_TOKEN_ID=your_token_id_here
MUX_TOKEN_SECRET=your_token_secret_here
```

> `.env.local` is gitignored. Never commit it.

---

## 3. Run the SQL migration

Run this once in **Supabase SQL Editor** (Dashboard → SQL Editor → New query):

```sql
-- File: supabase-mux-live-automation.sql (at repo root)
ALTER TABLE church_live_events
  ADD COLUMN IF NOT EXISTS stream_key  text,
  ADD COLUMN IF NOT EXISTS provider    text DEFAULT 'mux',
  ADD COLUMN IF NOT EXISTS playback_id text;

CREATE INDEX IF NOT EXISTS idx_cle_stream_input_id
  ON church_live_events (stream_input_id)
  WHERE stream_input_id IS NOT NULL;
```

The RLS policy in the migration file is optional — run it only if your `church_live_events`
table has RLS enabled. It restricts `stream_key` visibility to church admins.

---

## 4. How a church creates a live stream

1. Church admin opens the app and taps **Live** in the bottom nav
2. Taps **Schedule Stream** (top-right button, visible only to church admins)
3. Fills in:
   - **Title** (required) — e.g. "Sunday Morning Service"
   - **Description** (optional)
   - **Date & time** (optional — leave blank to stream immediately)
4. Taps **Create Stream**
5. TheBride automatically:
   - Creates a Mux Live Stream via the Mux API
   - Stores `stream_input_id`, `stream_key`, `playback_id`, and `hls_url` in `church_live_events`
   - Navigates to the event page
6. Admin sees the **Stream Controls** panel with:
   - **Server URL**: `rtmps://global-live.mux.com:443/app`
   - **Stream Key**: hidden by default, Show/Copy buttons available
7. Admin pastes these into OBS (or any RTMP encoder)
8. When ready to go live, admin taps **Go Live** in the app
9. Viewers see the stream appear on `/live` and get push notifications

---

## 5. OBS settings

In OBS → Settings → Stream:

| Field | Value |
|-------|-------|
| Service | **Custom…** |
| Server | `rtmps://global-live.mux.com:443/app` |
| Stream Key | *(copy from the Stream Controls panel in TheBride)* |

Recommended output settings:
- **Encoder**: x264 or hardware encoder
- **Bitrate**: 2500–4000 kbps (720p) or 4000–6000 kbps (1080p)
- **Keyframe interval**: 2 seconds
- **Resolution**: 1280×720 or 1920×1080

---

## 6. How viewers watch

- The HLS URL is automatically set to `https://stream.mux.com/{PLAYBACK_ID}.m3u8`
- Viewers open `/live` and see the stream card
- Clicking the card opens `/live/{eventId}` with the HLS player
- The player handles iOS Safari (native HLS) and all other browsers (hls.js)

---

## 7. API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/live/create-mux-stream` | POST | Create Mux stream + insert `church_live_events` row |
| `/api/live/start` | POST | Set status=live, notify followers |
| `/api/live/end` | POST | Set status=ended, disable Mux stream |
| `/api/live/notify-followers` | POST | Send notifications + push to church followers |

All routes require a valid Supabase JWT in `Authorization: Bearer <token>`.
The caller must be a `church_admin` for the target church.

---

## 8. Testing checklist

- [ ] `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` set in `.env.local`
- [ ] SQL migration run in Supabase
- [ ] Church admin account exists with `role = 'church_admin'` and `church_id` set in `profiles`
- [ ] "Schedule Stream" button visible on `/live` when logged in as church admin
- [ ] Submitting form creates a row in `church_live_events` with `stream_key` populated
- [ ] Stream key visible in Stream Controls panel after creating
- [ ] OBS connects using server URL + stream key
- [ ] After tapping "Go Live", `status` changes to `live` in Supabase
- [ ] HLS player loads on `/live/{id}` when streaming from OBS
- [ ] Followers receive push notification when Go Live is pressed
- [ ] After "End Stream", `status` changes to `ended` and Mux stream is disabled
- [ ] Replay appears on `/live` under Replays section

---

## 9. Troubleshooting

**"Mux error: 401"** — Token ID or Secret is wrong. Double-check in Mux dashboard.

**"Mux error: 403"** — Token doesn't have Video write permissions. Regenerate with full access.

**"DB insert failed: column stream_key does not exist"** — SQL migration has not been run. Run it in Supabase SQL Editor.

**Stream key not showing in app** — Confirm the SQL migration ran and `stream_key` column exists. Also confirm the user's JWT is included when calling `/api/live/create-mux-stream`.

**Player shows "Stream is live but video is still connecting"** — This is expected for 10–30 seconds after pressing Go Live. Mux takes a moment to start the live stream. The page has a Refresh button. Once OBS is actively sending video, the player will load.

**OBS shows "Failed to connect to server"** — Make sure you're using `rtmps://` (not `rtmp://`) and port 443.

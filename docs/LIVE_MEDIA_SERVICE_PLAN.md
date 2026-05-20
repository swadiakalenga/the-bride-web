# Live Media Service Plan

App: TheBride  
Owner: GoldenGroup7 / Stephane Wa Diakalenga  
Last updated: 2026-05-20

> **Status: Planning — live streaming infrastructure not deployed yet.**  
> The app has a UI for live streams (`app/live/[id]/page.tsx`) and a `live_streams` table. This document defines the production media pipeline for when it is built.

---

## Goals

1. Church admins can start a live stream from the app.
2. Members see an active stream notification and can join to watch.
3. Uploaded videos (posts) are transcoded to HLS for adaptive bitrate on mobile.
4. Audio posts are transcoded to a consistent format (AAC/128kbps).
5. Media served via CDN — never direct from Supabase Storage on hot paths.

---

## Current State

- `live_streams` table exists. Records `broadcaster_id`, `title`, `status`, `viewer_count`.
- `app/live/[id]/page.tsx` — viewer page using a placeholder video player.
- No actual streaming protocol (RTMP/WebRTC) is implemented.
- Uploaded videos are stored raw in Supabase Storage `media` bucket.
- No transcoding pipeline exists.

---

## Architecture: Video Upload Pipeline

```
User uploads video (post)
         │
         ▼
  Client compresses + validates
  (lib/imageCompression.ts handles images;
   video is uploaded raw — this is the gap)
         │
         ▼
  Supabase Storage (raw bucket: media/raw/)
         │
         ▼
  Supabase Storage trigger / Postgres function
  → calls AWS MediaConvert job via Edge Function
         │
         ▼
  AWS MediaConvert
  ├── HLS playlist (.m3u8) → S3 thebride-media-prod/hls/
  └── MP4 thumbnail poster → S3 thebride-media-prod/thumbs/
         │
         ▼
  CloudFront CDN
  → serves https://cdn.thebride.app/hls/{post_id}/index.m3u8
         │
         ▼
  App media player reads CloudFront URL (not raw Supabase URL)
```

---

## Architecture: Live Streaming

### Option A — Mux (recommended, simplest)

```
Church admin (broadcaster)
         │
         ▼
  Capacitor app → Mux Live Stream API → create stream
  Returns: stream key + RTMP ingest URL
         │
         ▼
  iOS/Android device pushes RTMP
  (using ReplayKit on iOS, MediaProjection on Android,
   or a native RTMP library like HaishinKit)
         │
         ▼
  Mux transcodes → HLS
         │
         ▼
  Members watch: Mux playback URL → HLS player
         │
         ▼
  On stream end → Mux sends webhook → /api/webhooks/mux
  → update live_streams.status = 'ended'
```

**Mux pricing**: ~$0.015/min of input (encoding) + $0.0025/GB delivered. For a 1-hour church service to 50 viewers: ~$1 encoding + ~$1–2 bandwidth = ~$3/stream.

### Option B — AWS IVS (AWS Interactive Video Service)

Same flow but using AWS instead of Mux. More setup, lower per-minute cost at scale.

### Option C — WebRTC (peer-to-peer, no RTMP)

Lower quality, works without a streaming server for small groups (<10 viewers). Not recommended for church services with 50+ viewers.

**Recommendation**: Start with **Mux** for simplicity. Switch to IVS when monthly streaming hours exceed 500.

---

## AWS Services Setup

### S3 Buckets

#### `thebride-media-prod`
```
Purpose: Transcoded video/audio output + thumbnails
Region: us-east-1
Versioning: disabled (large binary files — versioning wastes storage)
Lifecycle: delete raw/ objects after 7 days (raw uploads are temporary)
Public access: blocked (CloudFront accesses via OAC)

Folder structure:
  raw/        ← temporary upload target (deleted after transcoding)
  hls/        ← transcoded HLS playlists and segments
  thumbs/     ← video poster images
  audio/      ← transcoded audio files
```

CORS configuration for the bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://thebride.app"],
    "MaxAgeSeconds": 3600
  }
]
```

### CloudFront Distribution

```
Origin: thebride-media-prod S3 bucket (Origin Access Control — not public)
Domain alias: cdn.thebride.app
SSL certificate: ACM certificate for cdn.thebride.app (must be in us-east-1)
Cache behaviors:
  /hls/*        → Cache-Control: max-age=10 (live segments change frequently)
  /thumbs/*     → Cache-Control: max-age=86400
  /audio/*      → Cache-Control: max-age=86400
  Default       → Cache-Control: max-age=3600
Compress: Yes (Gzip/Brotli)
HTTP/2: Yes
```

Add to Cloudflare DNS:
```
CNAME   cdn   dXXXXXXXXXXXXXX.cloudfront.net
```

### MediaConvert

Create a **MediaConvert job template** for HLS output:

```json
{
  "Name": "thebride-hls-template",
  "Settings": {
    "OutputGroups": [{
      "Name": "HLS",
      "OutputGroupSettings": {
        "Type": "HLS_GROUP_SETTINGS",
        "HlsGroupSettings": {
          "SegmentLength": 6,
          "MinSegmentLength": 0,
          "DestinationSettings": { "S3Settings": { "StorageClass": "STANDARD" } }
        }
      },
      "Outputs": [
        {
          "NameModifier": "_1080p",
          "VideoDescription": { "Width": 1920, "Height": 1080,
            "CodecSettings": { "Codec": "H_264", "H264Settings": { "Bitrate": 3000000 }}},
          "AudioDescriptions": [{ "CodecSettings": { "Codec": "AAC",
            "AacSettings": { "Bitrate": 128000, "SampleRate": 48000 }}}]
        },
        {
          "NameModifier": "_720p",
          "VideoDescription": { "Width": 1280, "Height": 720,
            "CodecSettings": { "Codec": "H_264", "H264Settings": { "Bitrate": 1500000 }}},
          "AudioDescriptions": [{ "CodecSettings": { "Codec": "AAC",
            "AacSettings": { "Bitrate": 128000, "SampleRate": 48000 }}}]
        },
        {
          "NameModifier": "_480p",
          "VideoDescription": { "Width": 854, "Height": 480,
            "CodecSettings": { "Codec": "H_264", "H264Settings": { "Bitrate": 600000 }}},
          "AudioDescriptions": [{ "CodecSettings": { "Codec": "AAC",
            "AacSettings": { "Bitrate": 96000, "SampleRate": 48000 }}}]
        }
      ]
    }]
  }
}
```

### IAM Role for MediaConvert

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::thebride-media-prod/raw/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": [
        "arn:aws:s3:::thebride-media-prod/hls/*",
        "arn:aws:s3:::thebride-media-prod/thumbs/*",
        "arn:aws:s3:::thebride-media-prod/audio/*"
      ]
    }
  ]
}
```

---

## Mux Setup (Live Streaming)

### Account
1. Go to [mux.com](https://mux.com) → create account under GoldenGroup7.
2. **Settings** → **API Access Tokens** → create a token with **Video: Full Access**.
3. Copy **Token ID** and **Token Secret**.

### Webhook
1. In Mux dashboard → **Settings** → **Webhooks** → **Add webhook endpoint**.
2. URL: `https://thebride.app/api/webhooks/mux`.
3. Events: `video.live_stream.active`, `video.live_stream.idle`, `video.live_stream.disabled`.

### API routes to build (not yet implemented)

#### `POST /api/live/create-stream`
```typescript
// Creates a Mux live stream and stores in live_streams table
// Returns: { streamKey, playbackUrl }
// Church admin calls this when tapping "Go Live"
```

#### `POST /api/webhooks/mux`
```typescript
// On video.live_stream.active → update live_streams.status = 'live'
// On video.live_stream.idle → update live_streams.status = 'ended'
// Verify Mux-Signature header before processing
```

#### `DELETE /api/live/[streamId]/end`
```typescript
// Church admin calls when stopping stream
// Calls Mux API to disable the stream
// Updates live_streams.status = 'ended', ended_at = now()
```

---

## Video Player Integration

Replace `<video src={rawUrl} />` in the media player with an HLS-capable player.

### Recommended: `hls.js` (web) + native player (iOS/Android)

```bash
npm install hls.js
```

```typescript
// app/components/feed/MediaPlayer.tsx — extend for HLS
import Hls from "hls.js";

// In useEffect:
if (url.endsWith(".m3u8") && Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(url);
  hls.attachMedia(videoRef.current);
}
// Safari supports HLS natively via <video src="...m3u8">
```

For live streams, the player reads `https://stream.mux.com/{playbackId}.m3u8`.

---

## Environment Variables

```bash
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=thebride-media-prod
AWS_CLOUDFRONT_DOMAIN=https://cdn.thebride.app
AWS_MEDIACONVERT_ENDPOINT=https://xxxx.mediaconvert.us-east-1.amazonaws.com
AWS_MEDIACONVERT_ROLE_ARN=arn:aws:iam::XXXXXXXXXXXX:role/thebride-mediaconvert-role
AWS_MEDIACONVERT_TEMPLATE=thebride-hls-template

# Mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SECRET=

# Public (safe for browser — Mux playback only, no write access)
NEXT_PUBLIC_MUX_ENV_KEY=    # from Mux Data dashboard (optional, for analytics)
```

---

## Testing Checklist

### Video transcoding
- [ ] Upload a short MP4 (under 10s) via a post — confirm MediaConvert job triggers
- [ ] Confirm HLS playlist appears in S3 at `hls/{post_id}/index.m3u8`
- [ ] Confirm thumbnail appears at `thumbs/{post_id}.jpg`
- [ ] Confirm CloudFront URL serves the `.m3u8` file
- [ ] Play the CloudFront HLS URL in Safari — confirm adaptive quality works
- [ ] Play on Chrome with `hls.js` — confirm playback
- [ ] Upload a 100MB video — confirm it does not crash the upload (set max to 500MB)
- [ ] Confirm raw/ file is deleted from S3 after 7 days (check lifecycle rule)

### Live streaming (Mux)
- [ ] Church admin creates a stream — confirm Mux stream created, `live_streams` row inserted
- [ ] Broadcast RTMP from OBS Studio to the stream key — confirm stream goes live
- [ ] Member opens the live page — confirm HLS player plays the stream
- [ ] Church admin ends stream — confirm status updates to `ended` in Supabase
- [ ] Mux webhook `video.live_stream.idle` received and signature verified
- [ ] Non-admin cannot call `POST /api/live/create-stream` for another church

### Performance
- [ ] P95 time-to-first-frame on a 4G connection < 3 seconds
- [ ] HLS 480p plays without buffering on a 3G connection
- [ ] CloudFront cache hit rate > 80% for VOD content (check CloudFront metrics)

---

## Cost Estimate (monthly, at 1,000 active users)

| Service | Usage assumption | Estimated cost |
|---------|-----------------|----------------|
| AWS MediaConvert | 50 videos × 5 min each | ~$2 |
| AWS S3 | 50GB stored | ~$1.15 |
| AWS CloudFront | 200GB delivered | ~$17 |
| Mux | 10 live streams × 60 min | ~$9 |
| **Total** | | **~$29/month** |

At 10,000 users, multiply by ~10 = ~$290/month. Budget accordingly.

---

## Go-live Checklist

- [ ] AWS account with MediaConvert and S3 configured
- [ ] CloudFront distribution live with `cdn.thebride.app` domain
- [ ] Mux account with webhook registered
- [ ] All API routes built and tested in test/sandbox mode
- [ ] HLS player working in Safari and Chrome
- [ ] MediaConvert job auto-triggered on video upload
- [ ] Raw files deleted from S3 after transcoding
- [ ] Streaming tested end-to-end: broadcast → Mux → viewer
- [ ] Costs monitored via AWS Cost Explorer and Mux billing alerts

# TheBride

TheBride is a faith-based social platform for believers and churches, owned by GoldenGroup7 and Stephane Wa Diakalenga.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Storage
- Supabase Realtime

## Core Product

- Personal accounts use the member role.
- Church accounts use the church_admin role.
- Members post to the People feed.
- Church admins post to the Church feed.
- Posts support text, images, audio, and video.
- Social actions include likes, comments, replies, follows, church follows, messages, notifications, and post detail links.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Required Environment Variables

Create .env.local locally and configure these in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not expose a Supabase service_role key in this frontend app.

## Supabase Requirements

Required tables include:

- profiles
- posts
- comments
- likes
- comment_likes
- follows
- churches
- church_follows
- notifications
- post_views
- conversations
- conversation_participants
- messages
- message_requests
- church_memberships
- live_streams
- church_events
- event_rsvps
- prayer_requests
- prayer_supports
- devotionals
- tithing_configs
- donations

Required storage buckets:

- media: public read, authenticated upload
- avatars: public read, authenticated upload

Realtime must be enabled for:

- notifications
- messages
- live_streams, if live features are enabled

## Validation

```bash
npm run lint -- --quiet
npx tsc --noEmit
npm run build
```

Full lint currently reports React Compiler migration warnings for older client-side loader effects and Next image optimization warnings where plain img tags are still used. These warnings do not block deployment, but they should be cleaned up gradually.

## Vercel Deployment Checklist

- Import the repository into Vercel.
- Set the framework preset to Next.js.
- Set build command to npm run build.
- Set install command to npm install.
- Add NEXT_PUBLIC_SUPABASE_URL.
- Add NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Confirm no service_role key is present in Vercel env vars.
- Run supabase-migration.sql in Supabase if the project schema is not up to date.
- Review and apply supabase-production-rls.sql before public launch.
- Review and apply supabase-notification-triggers.sql so follow, like, comment, and reply notifications are automatic.
- Enable Supabase Realtime publication for notifications.
- Confirm media and avatars buckets exist.
- Test signup, login, People feed post, Church feed post, like, comment, reply, follow, notifications, and post detail links after deployment.

## Production Notes

The current frontend now filters notification reads/counts by recipient_user_id, and feed edit/delete mutations include user ownership filters. Supabase RLS must still enforce these rules server-side before launch.

-- Migration: add link preview columns to posts
-- Run once in your Supabase SQL editor.
-- Safe to re-run (all changes are guarded with IF NOT EXISTS / DO blocks).

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS link_url          text,
  ADD COLUMN IF NOT EXISTS link_title        text,
  ADD COLUMN IF NOT EXISTS link_description  text,
  ADD COLUMN IF NOT EXISTS link_image_url    text,
  ADD COLUMN IF NOT EXISTS link_site_name    text,
  ADD COLUMN IF NOT EXISTS link_domain       text;

-- Optional: partial index so the feed can efficiently filter posts
-- that have a link preview (useful if you want to query link-only posts).
CREATE INDEX IF NOT EXISTS idx_posts_link_url
  ON posts (link_url)
  WHERE link_url IS NOT NULL;

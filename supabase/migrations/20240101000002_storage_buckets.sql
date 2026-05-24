-- Migration: Create Supabase Storage buckets and policies
-- Requirements: 3.5 (question images), 15.4 (event logos)

-- ============================================================
-- 1. Create storage buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-logos',
  'event-logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS policies for `question-images` (private bucket)
--
--    Path convention: {admin_id}/{event_id}/{filename}
--    Authenticated admins may upload and read images that
--    belong to events they own.
-- ============================================================

-- Allow authenticated admins to upload (INSERT) question images
-- for events they own.
CREATE POLICY "admin_upload_question_images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated admins to read (SELECT) question images
-- for events they own.
CREATE POLICY "admin_read_question_images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated admins to update question images they own.
CREATE POLICY "admin_update_question_images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated admins to delete question images they own.
CREATE POLICY "admin_delete_question_images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 3. RLS policies for `event-logos` (public bucket)
--
--    Path convention: {admin_id}/{event_id}/{filename}
--    Public read for everyone; authenticated admins manage
--    their own logos.
-- ============================================================

-- Allow anyone (including unauthenticated participants) to read
-- event logos (bucket is public, but explicit policy is best practice).
CREATE POLICY "public_read_event_logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'event-logos');

-- Allow authenticated admins to upload (INSERT) event logos
-- under their own admin_id prefix.
CREATE POLICY "admin_upload_event_logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated admins to update event logos they own.
CREATE POLICY "admin_update_event_logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated admins to delete event logos they own.
CREATE POLICY "admin_delete_event_logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

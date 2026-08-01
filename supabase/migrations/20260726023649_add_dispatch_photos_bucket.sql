/*
# Create dispatch-photos storage bucket

1. Overview
- Creates a public storage bucket named `dispatch-photos` to store photo files uploaded directly from the dispatch detail screen.

2. Storage
- New bucket: `dispatch-photos` (public read, so the frontend can render uploaded photos via their public URL).

3. Security
- Storage policies allow anon + authenticated to upload and read, since this is a single-tenant no-auth app.

4. Notes
- Idempotent: uses IF NOT EXISTS for the bucket.
*/

INSERT INTO storage.buckets (id, name, public)
SELECT 'dispatch-photos', 'dispatch-photos', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'dispatch-photos');

DROP POLICY IF EXISTS "anon_upload_dispatch_photos" ON storage.objects;
CREATE POLICY "anon_upload_dispatch_photos" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'dispatch-photos');

DROP POLICY IF EXISTS "anon_read_dispatch_photos" ON storage.objects;
CREATE POLICY "anon_read_dispatch_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'dispatch-photos');

DROP POLICY IF EXISTS "anon_delete_dispatch_photos" ON storage.objects;
CREATE POLICY "anon_delete_dispatch_photos" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'dispatch-photos');
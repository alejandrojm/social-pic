-- ============================================================
-- Social Pic — Storage Policies
-- Ejecuta esto DESPUÉS de crear el bucket "photos" en Storage
-- ============================================================

-- Permite subir fotos sin autenticación
CREATE POLICY "Anyone can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'photos');

-- Permite leer/ver fotos públicamente
CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Permite eliminar fotos (para admins)
CREATE POLICY "Anyone can delete photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'photos');

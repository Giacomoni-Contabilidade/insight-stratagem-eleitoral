ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS candidate_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_batch_name TEXT;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_batch_status TEXT;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_batch_requested_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_batch_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_batch_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_batch_error TEXT;

CREATE INDEX IF NOT EXISTS municipality_map_import_hashes_gemini_batch_status_idx
    ON public.municipality_map_import_hashes (gemini_batch_status);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_import_hashes'
          AND policyname = 'Authenticated users can update municipality map import hashes'
    ) THEN
        CREATE POLICY "Authenticated users can update municipality map import hashes"
            ON public.municipality_map_import_hashes
            FOR UPDATE
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

GRANT UPDATE ON public.municipality_map_import_hashes TO authenticated;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_input_mode TEXT NOT NULL DEFAULT 'csv';

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    DROP CONSTRAINT IF EXISTS municipality_map_import_hashes_gemini_input_mode_check;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD CONSTRAINT municipality_map_import_hashes_gemini_input_mode_check
    CHECK (gemini_input_mode IN ('csv', 'dossier'));

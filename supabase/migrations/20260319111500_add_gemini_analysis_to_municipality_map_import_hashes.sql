ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_analysis TEXT;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_model TEXT;

ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS analysis_created_at TIMESTAMP WITH TIME ZONE;

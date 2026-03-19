ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_candidate_scope TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

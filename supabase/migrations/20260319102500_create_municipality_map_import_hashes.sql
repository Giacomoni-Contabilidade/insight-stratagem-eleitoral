CREATE TABLE public.municipality_map_import_hashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_hash TEXT NOT NULL UNIQUE,
    gemini_analysis TEXT,
    gemini_model TEXT,
    analysis_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT municipality_map_import_hashes_file_hash_format CHECK (file_hash ~ '^[a-f0-9]{64}$')
);

ALTER TABLE public.municipality_map_import_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view municipality map import hashes"
    ON public.municipality_map_import_hashes
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert municipality map import hashes"
    ON public.municipality_map_import_hashes
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

GRANT SELECT, INSERT ON public.municipality_map_import_hashes TO authenticated;
GRANT ALL ON public.municipality_map_import_hashes TO service_role;

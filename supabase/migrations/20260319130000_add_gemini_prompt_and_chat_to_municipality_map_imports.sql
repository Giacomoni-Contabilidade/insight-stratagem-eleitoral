ALTER TABLE IF EXISTS public.municipality_map_import_hashes
    ADD COLUMN IF NOT EXISTS gemini_prompt TEXT;

CREATE TABLE IF NOT EXISTS public.municipality_map_import_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_hash TEXT NOT NULL REFERENCES public.municipality_map_import_hashes(file_hash) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT municipality_map_import_chat_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS municipality_map_import_chat_messages_file_hash_created_at_idx
    ON public.municipality_map_import_chat_messages (file_hash, created_at);

ALTER TABLE public.municipality_map_import_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_import_chat_messages'
          AND policyname = 'Authenticated users can view municipality map chat messages'
    ) THEN
        CREATE POLICY "Authenticated users can view municipality map chat messages"
            ON public.municipality_map_import_chat_messages
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_import_chat_messages'
          AND policyname = 'Authenticated users can insert municipality map chat messages'
    ) THEN
        CREATE POLICY "Authenticated users can insert municipality map chat messages"
            ON public.municipality_map_import_chat_messages
            FOR INSERT
            TO authenticated
            WITH CHECK (true);
    END IF;
END
$$;

GRANT SELECT, INSERT ON public.municipality_map_import_chat_messages TO authenticated;
GRANT ALL ON public.municipality_map_import_chat_messages TO service_role;

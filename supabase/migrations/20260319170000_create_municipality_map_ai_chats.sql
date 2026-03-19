CREATE TABLE IF NOT EXISTS public.municipality_map_ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_hash TEXT NOT NULL REFERENCES public.municipality_map_import_hashes(file_hash) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Novo chat',
    candidate_scope TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    gemini_model TEXT,
    gemini_input_mode TEXT NOT NULL DEFAULT 'dossier',
    gemini_prompt TEXT,
    gemini_analysis TEXT,
    analysis_created_at TIMESTAMP WITH TIME ZONE,
    gemini_batch_name TEXT,
    gemini_batch_status TEXT,
    gemini_batch_requested_at TIMESTAMP WITH TIME ZONE,
    gemini_batch_updated_at TIMESTAMP WITH TIME ZONE,
    gemini_batch_completed_at TIMESTAMP WITH TIME ZONE,
    gemini_batch_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT municipality_map_ai_chats_gemini_input_mode_check
        CHECK (gemini_input_mode IN ('csv', 'dossier'))
);

CREATE INDEX IF NOT EXISTS municipality_map_ai_chats_file_hash_idx
    ON public.municipality_map_ai_chats (file_hash, created_at DESC);

ALTER TABLE public.municipality_map_ai_chats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_ai_chats'
          AND policyname = 'Authenticated users can view municipality map ai chats'
    ) THEN
        CREATE POLICY "Authenticated users can view municipality map ai chats"
            ON public.municipality_map_ai_chats
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
          AND tablename = 'municipality_map_ai_chats'
          AND policyname = 'Authenticated users can insert municipality map ai chats'
    ) THEN
        CREATE POLICY "Authenticated users can insert municipality map ai chats"
            ON public.municipality_map_ai_chats
            FOR INSERT
            TO authenticated
            WITH CHECK (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_ai_chats'
          AND policyname = 'Authenticated users can update municipality map ai chats'
    ) THEN
        CREATE POLICY "Authenticated users can update municipality map ai chats"
            ON public.municipality_map_ai_chats
            FOR UPDATE
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_ai_chats'
          AND policyname = 'Authenticated users can delete municipality map ai chats'
    ) THEN
        CREATE POLICY "Authenticated users can delete municipality map ai chats"
            ON public.municipality_map_ai_chats
            FOR DELETE
            TO authenticated
            USING (true);
    END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.municipality_map_ai_chats TO authenticated;
GRANT ALL ON public.municipality_map_ai_chats TO service_role;

CREATE TABLE IF NOT EXISTS public.municipality_map_ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.municipality_map_ai_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT municipality_map_ai_chat_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS municipality_map_ai_chat_messages_chat_id_created_at_idx
    ON public.municipality_map_ai_chat_messages (chat_id, created_at);

ALTER TABLE public.municipality_map_ai_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_ai_chat_messages'
          AND policyname = 'Authenticated users can view municipality map ai chat messages'
    ) THEN
        CREATE POLICY "Authenticated users can view municipality map ai chat messages"
            ON public.municipality_map_ai_chat_messages
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
          AND tablename = 'municipality_map_ai_chat_messages'
          AND policyname = 'Authenticated users can insert municipality map ai chat messages'
    ) THEN
        CREATE POLICY "Authenticated users can insert municipality map ai chat messages"
            ON public.municipality_map_ai_chat_messages
            FOR INSERT
            TO authenticated
            WITH CHECK (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'municipality_map_ai_chat_messages'
          AND policyname = 'Authenticated users can delete municipality map ai chat messages'
    ) THEN
        CREATE POLICY "Authenticated users can delete municipality map ai chat messages"
            ON public.municipality_map_ai_chat_messages
            FOR DELETE
            TO authenticated
            USING (true);
    END IF;
END
$$;

GRANT SELECT, INSERT, DELETE ON public.municipality_map_ai_chat_messages TO authenticated;
GRANT ALL ON public.municipality_map_ai_chat_messages TO service_role;

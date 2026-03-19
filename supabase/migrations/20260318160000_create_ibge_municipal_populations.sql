-- IBGE municipal population table.
-- Intended for bulk imports keyed by the 7-digit IBGE municipality code.

CREATE TABLE public.ibge_municipal_populations (
    codigo_ibge CHAR(7) NOT NULL,
    uf TEXT NOT NULL,
    municipality_name TEXT NOT NULL,
    reference_year INTEGER NOT NULL,
    reference_date DATE,
    population INTEGER NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT ibge_municipal_populations_pkey PRIMARY KEY (codigo_ibge, reference_year),
    CONSTRAINT ibge_municipal_populations_codigo_ibge_format CHECK (codigo_ibge ~ '^[0-9]{7}$'),
    CONSTRAINT ibge_municipal_populations_uf_format CHECK (char_length(uf) = 2),
    CONSTRAINT ibge_municipal_populations_reference_year_valid CHECK (reference_year >= 1900 AND reference_year <= 2100),
    CONSTRAINT ibge_municipal_populations_population_nonnegative CHECK (population >= 0)
);

ALTER TABLE public.ibge_municipal_populations ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ibge_municipal_populations TO authenticated;
GRANT ALL ON public.ibge_municipal_populations TO service_role;

CREATE POLICY "Authenticated users can view IBGE municipal populations"
    ON public.ibge_municipal_populations
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert IBGE municipal populations"
    ON public.ibge_municipal_populations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update IBGE municipal populations"
    ON public.ibge_municipal_populations
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE INDEX idx_ibge_municipal_populations_uf
    ON public.ibge_municipal_populations (uf);

CREATE INDEX idx_ibge_municipal_populations_name
    ON public.ibge_municipal_populations (municipality_name);

CREATE INDEX idx_ibge_municipal_populations_year
    ON public.ibge_municipal_populations (reference_year DESC);

CREATE OR REPLACE VIEW public.ibge_municipal_populations_latest AS
SELECT DISTINCT ON (codigo_ibge)
    codigo_ibge,
    uf,
    municipality_name,
    reference_year,
    reference_date,
    population,
    source,
    created_at,
    updated_at
FROM public.ibge_municipal_populations
ORDER BY codigo_ibge, reference_year DESC;

CREATE TRIGGER update_ibge_municipal_populations_updated_at
    BEFORE UPDATE ON public.ibge_municipal_populations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

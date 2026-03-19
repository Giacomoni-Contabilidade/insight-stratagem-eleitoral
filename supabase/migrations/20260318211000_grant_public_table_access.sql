GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidatures TO authenticated;
GRANT ALL ON public.candidatures TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytical_groups TO authenticated;
GRANT ALL ON public.analytical_groups TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.ibge_municipal_populations TO authenticated;
GRANT ALL ON public.ibge_municipal_populations TO service_role;

GRANT SELECT ON public.ibge_municipal_populations_latest TO authenticated;
GRANT ALL ON public.ibge_municipal_populations_latest TO service_role;

CREATE OR REPLACE FUNCTION public.get_candidature_counts()
RETURNS TABLE(dataset_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.dataset_id, COUNT(*) as count
  FROM public.candidatures c
  INNER JOIN public.datasets d ON d.id = c.dataset_id
  WHERE d.user_id = auth.uid()
     OR public.has_dataset_access(auth.uid(), c.dataset_id)
  GROUP BY c.dataset_id
$$;
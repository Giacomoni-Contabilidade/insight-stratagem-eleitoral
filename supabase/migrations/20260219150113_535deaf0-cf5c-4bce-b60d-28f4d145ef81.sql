ALTER TABLE public.datasets
ADD COLUMN candidacy_count integer NOT NULL DEFAULT 0,
ADD COLUMN total_votes bigint NOT NULL DEFAULT 0,
ADD COLUMN total_expenses numeric NOT NULL DEFAULT 0;

-- Backfill existing datasets
UPDATE public.datasets d SET
  candidacy_count = sub.cnt,
  total_votes = sub.tv,
  total_expenses = sub.te
FROM (
  SELECT dataset_id, COUNT(*) as cnt, COALESCE(SUM(votes), 0) as tv, COALESCE(SUM(total_expenses), 0) as te
  FROM public.candidatures
  GROUP BY dataset_id
) sub
WHERE d.id = sub.dataset_id;

-- Drop the RPC we no longer need
DROP FUNCTION IF EXISTS public.get_candidature_counts();
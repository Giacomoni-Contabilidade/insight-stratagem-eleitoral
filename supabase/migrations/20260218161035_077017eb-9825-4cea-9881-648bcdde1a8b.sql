CREATE UNIQUE INDEX IF NOT EXISTS idx_analytical_groups_user_name 
ON public.analytical_groups (user_id, name);
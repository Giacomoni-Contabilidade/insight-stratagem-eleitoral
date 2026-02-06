-- Create datasets table
CREATE TABLE public.datasets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    state TEXT NOT NULL,
    position TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidatures table
CREATE TABLE public.candidatures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    party TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'Não informado',
    race TEXT NOT NULL DEFAULT 'Não informado',
    education TEXT NOT NULL DEFAULT 'Não informado',
    occupation TEXT NOT NULL DEFAULT 'Não informado',
    votes INTEGER NOT NULL DEFAULT 0,
    financial_expenses NUMERIC NOT NULL DEFAULT 0,
    estimated_donations NUMERIC NOT NULL DEFAULT 0,
    total_expenses NUMERIC NOT NULL DEFAULT 0,
    cost_per_vote NUMERIC NOT NULL DEFAULT 0,
    expenses JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create analytical_groups table
CREATE TABLE public.analytical_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    categories TEXT[] NOT NULL DEFAULT '{}',
    color TEXT NOT NULL DEFAULT '#215437',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytical_groups ENABLE ROW LEVEL SECURITY;

-- Helper function to check dataset ownership
CREATE OR REPLACE FUNCTION public.is_dataset_owner(dataset_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.datasets
        WHERE id = dataset_uuid
        AND user_id = auth.uid()
    )
$$;

-- RLS Policies for datasets
CREATE POLICY "Users can view their own datasets"
    ON public.datasets FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own datasets"
    ON public.datasets FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own datasets"
    ON public.datasets FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own datasets"
    ON public.datasets FOR DELETE
    USING (user_id = auth.uid());

-- RLS Policies for candidatures
CREATE POLICY "Users can view candidatures from their datasets"
    ON public.candidatures FOR SELECT
    USING (public.is_dataset_owner(dataset_id));

CREATE POLICY "Users can insert candidatures to their datasets"
    ON public.candidatures FOR INSERT
    WITH CHECK (public.is_dataset_owner(dataset_id));

CREATE POLICY "Users can update candidatures from their datasets"
    ON public.candidatures FOR UPDATE
    USING (public.is_dataset_owner(dataset_id));

CREATE POLICY "Users can delete candidatures from their datasets"
    ON public.candidatures FOR DELETE
    USING (public.is_dataset_owner(dataset_id));

-- RLS Policies for analytical_groups
CREATE POLICY "Users can view their own analytical groups"
    ON public.analytical_groups FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own analytical groups"
    ON public.analytical_groups FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own analytical groups"
    ON public.analytical_groups FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own analytical groups"
    ON public.analytical_groups FOR DELETE
    USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_datasets_updated_at
    BEFORE UPDATE ON public.datasets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_datasets_user_id ON public.datasets(user_id);
CREATE INDEX idx_candidatures_dataset_id ON public.candidatures(dataset_id);
CREATE INDEX idx_analytical_groups_user_id ON public.analytical_groups(user_id);
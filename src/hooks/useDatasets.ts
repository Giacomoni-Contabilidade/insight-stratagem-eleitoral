import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Dataset, 
  Candidacy, 
  AnalyticalGroup,
  type LegalExpenseCategory 
} from '@/types/campaign';
import type { User } from '@supabase/supabase-js';

interface DatabaseDataset {
  id: string;
  user_id: string;
  name: string;
  year: number;
  state: string;
  position: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseCandidature {
  id: string;
  dataset_id: string;
  name: string;
  party: string;
  gender: string;
  race: string;
  education: string;
  occupation: string;
  votes: number;
  financial_expenses: number;
  estimated_donations: number;
  total_expenses: number;
  cost_per_vote: number;
  expenses: Record<string, number>;
  created_at: string;
}

interface DatabaseAnalyticalGroup {
  id: string;
  user_id: string;
  name: string;
  categories: string[];
  color: string;
  created_at: string;
}

const DEFAULT_ANALYTICAL_GROUPS: Omit<AnalyticalGroup, 'id'>[] = [
  {
    name: 'Marketing Digital',
    categories: [
      'Criação e inclusão de páginas na internet',
      'Despesa com Impulsionamento de Conteúdos',
    ],
    color: '#215437',
  },
  {
    name: 'Mídia Tradicional',
    categories: [
      'Publicidade por jornais e revistas',
      'Produção de programas de rádio, televisão ou vídeo',
      'Publicidade por carros de som',
      'Produção de jingles, vinhetas e slogans',
    ],
    color: '#1b3a4b',
  },
  {
    name: 'Campanha de Rua',
    categories: [
      'Atividades de militância e mobilização de rua',
      'Comícios',
      'Publicidade por adesivos',
      'Publicidade por materiais impressos',
    ],
    color: '#e4a432',
  },
  {
    name: 'Estrutura e Pessoal',
    categories: [
      'Despesas com pessoal',
      'Locação/cessão de bens imóveis',
      'Pré-instalação física de comitê de campanha',
      'Materiais de expediente',
      'Energia elétrica',
      'Água',
      'Telefone',
    ],
    color: '#7eb26d',
  },
  {
    name: 'Transporte e Logística',
    categories: [
      'Cessão ou locação de veículos',
      'Combustíveis e lubrificantes',
      'Despesas com transporte ou deslocamento',
    ],
    color: '#d57a55',
  },
];

export const useDatasets = (authUser?: User | null, authIsAuthenticated?: boolean) => {
  const user = authUser ?? null;
  const isAuthenticated = authIsAuthenticated ?? false;
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analyticalGroups, setAnalyticalGroups] = useState<AnalyticalGroup[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setDatasets([]);
      setAnalyticalGroups([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch datasets and analytical groups in parallel
      const [datasetsRes, groupsRes] = await Promise.all([
        supabase.from('datasets').select('*').order('created_at', { ascending: false }),
        supabase.from('analytical_groups').select('*').order('created_at', { ascending: true }),
      ]);

      if (datasetsRes.error) throw datasetsRes.error;
      if (groupsRes.error) throw groupsRes.error;

      const dbDatasets = datasetsRes.data as DatabaseDataset[];
      const dbGroups = groupsRes.data as DatabaseAnalyticalGroup[];

      // Fetch candidatures for all datasets
      const datasetIds = dbDatasets.map(d => d.id);
      let candidatures: DatabaseCandidature[] = [];

      if (datasetIds.length > 0) {
        const { data, error } = await supabase
          .from('candidatures')
          .select('*')
          .in('dataset_id', datasetIds);

        if (error) throw error;
        candidatures = data as DatabaseCandidature[];
      }

      // Transform to app format
      const transformedDatasets: Dataset[] = dbDatasets.map(d => ({
        id: d.id,
        name: d.name,
        year: d.year,
        state: d.state,
        position: d.position,
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at),
        candidacies: candidatures
          .filter(c => c.dataset_id === d.id)
          .map(c => ({
            id: c.id,
            datasetId: c.dataset_id,
            name: c.name,
            party: c.party,
            gender: c.gender as any,
            race: c.race as any,
            education: c.education as any,
            occupation: c.occupation,
            votes: c.votes,
            financialExpenses: Number(c.financial_expenses),
            estimatedDonations: Number(c.estimated_donations),
            totalExpenses: Number(c.total_expenses),
            costPerVote: Number(c.cost_per_vote),
            financialExpensesPct: Number(c.total_expenses) > 0 
              ? Number(c.financial_expenses) / Number(c.total_expenses) 
              : 0,
            estimatedDonationsPct: Number(c.total_expenses) > 0 
              ? Number(c.estimated_donations) / Number(c.total_expenses) 
              : 0,
            expenses: c.expenses as Record<LegalExpenseCategory, number>,
          })),
      }));

      setDatasets(transformedDatasets);

      // If no analytical groups, create defaults
      if (dbGroups.length === 0 && user) {
        const defaultGroups = await createDefaultAnalyticalGroups();
        setAnalyticalGroups(defaultGroups);
      } else {
        setAnalyticalGroups(dbGroups.map(g => ({
          id: g.id,
          name: g.name,
          categories: g.categories as LegalExpenseCategory[],
          color: g.color,
        })));
      }

      // Set active dataset to first one if none selected
      setActiveDatasetId(prev => {
        if (!prev && transformedDatasets.length > 0) {
          return transformedDatasets[0].id;
        }
        return prev;
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createDefaultAnalyticalGroups = async (): Promise<AnalyticalGroup[]> => {
    const groups: AnalyticalGroup[] = [];
    
    for (const group of DEFAULT_ANALYTICAL_GROUPS) {
      const { data, error } = await supabase
        .from('analytical_groups')
        .insert({
          user_id: user!.id,
          name: group.name,
          categories: group.categories,
          color: group.color,
        })
        .select()
        .single();

      if (!error && data) {
        groups.push({
          id: data.id,
          name: data.name,
          categories: data.categories as LegalExpenseCategory[],
          color: data.color,
        });
      }
    }

    return groups;
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    } else {
      setDatasets([]);
      setAnalyticalGroups([]);
      setActiveDatasetId(null);
      setLoading(false);
    }
  }, [isAuthenticated, fetchData]);

  const addDataset = async (
    datasetData: Omit<Dataset, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return null;
    }

    try {
      // Create dataset
      const { data: newDataset, error: datasetError } = await supabase
        .from('datasets')
        .insert({
          user_id: user.id,
          name: datasetData.name,
          year: datasetData.year,
          state: datasetData.state,
          position: datasetData.position,
        })
        .select()
        .single();

      if (datasetError) throw datasetError;

      // Create candidatures
      if (datasetData.candidacies.length > 0) {
        const candidaturesToInsert = datasetData.candidacies.map(c => ({
          dataset_id: newDataset.id,
          name: c.name,
          party: c.party,
          gender: c.gender,
          race: c.race,
          education: c.education,
          occupation: c.occupation,
          votes: c.votes,
          financial_expenses: c.financialExpenses,
          estimated_donations: c.estimatedDonations,
          total_expenses: c.totalExpenses,
          cost_per_vote: c.costPerVote,
          expenses: c.expenses,
        }));

        const { error: candidaturesError } = await supabase
          .from('candidatures')
          .insert(candidaturesToInsert);

        if (candidaturesError) {
          // Rollback: delete the incomplete dataset
          await supabase.from('datasets').delete().eq('id', newDataset.id);
          throw candidaturesError;
        }
      }

      await fetchData();
      setActiveDatasetId(newDataset.id);
      
      return newDataset.id;
    } catch (error) {
      console.error('Error creating dataset:', error);
      toast.error('Erro ao criar dataset');
      return null;
    }
  };

  const deleteDataset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (activeDatasetId === id) {
        setActiveDatasetId(null);
      }
      
      await fetchData();
      toast.success('Dataset excluído');
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast.error('Erro ao excluir dataset');
    }
  };

  const addAnalyticalGroup = async (data: Omit<AnalyticalGroup, 'id'>): Promise<string | null> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return null;
    }

    try {
      const { data: newGroup, error } = await supabase
        .from('analytical_groups')
        .insert({
          user_id: user.id,
          name: data.name,
          categories: data.categories,
          color: data.color || '#215437',
        })
        .select()
        .single();

      if (error) throw error;
      await fetchData();
      return newGroup.id;
    } catch (error) {
      console.error('Error creating analytical group:', error);
      toast.error('Erro ao criar grupo');
      return null;
    }
  };

  const updateAnalyticalGroup = async (id: string, updates: Partial<AnalyticalGroup>) => {
    try {
      const { error } = await supabase
        .from('analytical_groups')
        .update({
          name: updates.name,
          categories: updates.categories,
          color: updates.color,
        })
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating analytical group:', error);
      toast.error('Erro ao atualizar grupo');
    }
  };

  const deleteAnalyticalGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from('analytical_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchData();
      toast.success('Grupo excluído');
    } catch (error) {
      console.error('Error deleting analytical group:', error);
      toast.error('Erro ao excluir grupo');
    }
  };

  const getActiveDataset = () => {
    return datasets.find(d => d.id === activeDatasetId);
  };

  return {
    datasets,
    analyticalGroups,
    activeDatasetId,
    setActiveDatasetId,
    loading,
    addDataset,
    deleteDataset,
    addAnalyticalGroup,
    updateAnalyticalGroup,
    deleteAnalyticalGroup,
    getActiveDataset,
    refetch: fetchData,
  };
};

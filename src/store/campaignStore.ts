import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Dataset, 
  Candidacy, 
  AnalyticalGroup, 
  FilterState,
  LEGAL_EXPENSE_CATEGORIES,
  type LegalExpenseCategory 
} from '@/types/campaign';

interface CampaignStore {
  // Data
  datasets: Dataset[];
  analyticalGroups: AnalyticalGroup[];
  activeDatasetId: string | null;
  
  // UI State
  viewMode: 'legal' | 'analytical';
  filters: FilterState;
  
  // Actions - Datasets
  addDataset: (dataset: Omit<Dataset, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateDataset: (id: string, updates: Partial<Dataset>) => void;
  deleteDataset: (id: string) => void;
  setActiveDataset: (id: string | null) => void;
  
  // Actions - Analytical Groups
  addAnalyticalGroup: (group: Omit<AnalyticalGroup, 'id'>) => string;
  updateAnalyticalGroup: (id: string, updates: Partial<AnalyticalGroup>) => void;
  deleteAnalyticalGroup: (id: string) => void;
  
  // Actions - UI
  setViewMode: (mode: 'legal' | 'analytical') => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  
  // Computed
  getActiveDataset: () => Dataset | undefined;
  getFilteredCandidacies: () => Candidacy[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const DEFAULT_ANALYTICAL_GROUPS: AnalyticalGroup[] = [
  {
    id: 'digital',
    name: 'Marketing Digital',
    categories: [
      'Criação e inclusão de páginas na internet',
      'Despesa com Impulsionamento de Conteúdos',
    ],
    color: '#215437', // Dark green
  },
  {
    id: 'media',
    name: 'Mídia Tradicional',
    categories: [
      'Publicidade por jornais e revistas',
      'Produção de programas de rádio, televisão ou vídeo',
      'Publicidade por carros de som',
      'Produção de jingles, vinhetas e slogans',
    ],
    color: '#1b3a4b', // Dark teal
  },
  {
    id: 'street',
    name: 'Campanha de Rua',
    categories: [
      'Atividades de militância e mobilização de rua',
      'Comícios',
      'Publicidade por adesivos',
      'Publicidade por materiais impressos',
    ],
    color: '#e4a432', // Gold
  },
  {
    id: 'structure',
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
    color: '#7eb26d', // Light green
  },
  {
    id: 'transport',
    name: 'Transporte e Logística',
    categories: [
      'Cessão ou locação de veículos',
      'Combustíveis e lubrificantes',
      'Despesas com transporte ou deslocamento',
    ],
    color: '#d57a55', // Coral
  },
];

const DEFAULT_FILTERS: FilterState = {
  parties: [],
  genders: [],
  races: [],
  educations: [],
  occupations: [],
};

export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set, get) => ({
      // Initial State
      datasets: [],
      analyticalGroups: DEFAULT_ANALYTICAL_GROUPS,
      activeDatasetId: null,
      viewMode: 'legal',
      filters: DEFAULT_FILTERS,
      
      // Dataset Actions
      addDataset: (datasetData) => {
        const id = generateId();
        const now = new Date();
        const dataset: Dataset = {
          ...datasetData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ 
          datasets: [...state.datasets, dataset],
          activeDatasetId: id,
        }));
        return id;
      },
      
      updateDataset: (id, updates) => {
        set((state) => ({
          datasets: state.datasets.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date() } : d
          ),
        }));
      },
      
      deleteDataset: (id) => {
        set((state) => ({
          datasets: state.datasets.filter((d) => d.id !== id),
          activeDatasetId: state.activeDatasetId === id ? null : state.activeDatasetId,
        }));
      },
      
      setActiveDataset: (id) => {
        set({ activeDatasetId: id, filters: DEFAULT_FILTERS });
      },
      
      // Analytical Group Actions
      addAnalyticalGroup: (groupData) => {
        const id = generateId();
        const group: AnalyticalGroup = { ...groupData, id };
        set((state) => ({
          analyticalGroups: [...state.analyticalGroups, group],
        }));
        return id;
      },
      
      updateAnalyticalGroup: (id, updates) => {
        set((state) => ({
          analyticalGroups: state.analyticalGroups.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
      },
      
      deleteAnalyticalGroup: (id) => {
        set((state) => ({
          analyticalGroups: state.analyticalGroups.filter((g) => g.id !== id),
        }));
      },
      
      // UI Actions
      setViewMode: (mode) => set({ viewMode: mode }),
      
      setFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
      },
      
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      
      // Computed
      getActiveDataset: () => {
        const state = get();
        return state.datasets.find((d) => d.id === state.activeDatasetId);
      },
      
      getFilteredCandidacies: () => {
        const state = get();
        const dataset = state.datasets.find((d) => d.id === state.activeDatasetId);
        if (!dataset) return [];
        
        return dataset.candidacies.filter((c) => {
          const { filters } = state;
          
          if (filters.parties.length && !filters.parties.includes(c.party)) return false;
          if (filters.genders.length && !filters.genders.includes(c.gender)) return false;
          if (filters.races.length && !filters.races.includes(c.race)) return false;
          if (filters.educations.length && !filters.educations.includes(c.education)) return false;
          if (filters.occupations.length && !filters.occupations.includes(c.occupation)) return false;
          if (filters.minVotes !== undefined && c.votes < filters.minVotes) return false;
          if (filters.maxVotes !== undefined && c.votes > filters.maxVotes) return false;
          if (filters.minExpenses !== undefined && c.totalExpenses < filters.minExpenses) return false;
          if (filters.maxExpenses !== undefined && c.totalExpenses > filters.maxExpenses) return false;
          
          return true;
        });
      },
    }),
    {
      name: 'campaign-store',
      partialize: (state) => ({
        datasets: state.datasets,
        analyticalGroups: state.analyticalGroups,
      }),
    }
  )
);

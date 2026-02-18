import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useDatasets } from '@/hooks/useDatasets';
import { useAuth } from '@/hooks/useAuth';
import { Dataset, Candidacy, AnalyticalGroup, FilterState } from '@/types/campaign';

interface DataContextType {
  // Auth
  user: ReturnType<typeof useAuth>['user'];
  isAuthenticated: boolean;
  authLoading: boolean;
  signOut: () => Promise<void>;
  
  // Data
  datasets: Dataset[];
  analyticalGroups: AnalyticalGroup[];
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;
  dataLoading: boolean;
  
  // Actions
  addDataset: (data: Omit<Dataset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  deleteDataset: (id: string) => Promise<void>;
  addAnalyticalGroup: (data: Omit<AnalyticalGroup, 'id'>) => Promise<string | null>;
  updateAnalyticalGroup: (id: string, updates: Partial<AnalyticalGroup>) => Promise<void>;
  deleteAnalyticalGroup: (id: string) => Promise<void>;
  getActiveDataset: () => Dataset | undefined;
  refetch: () => Promise<void>;
  
  // UI State
  viewMode: 'legal' | 'analytical';
  setViewMode: (mode: 'legal' | 'analytical') => void;
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  getFilteredCandidacies: () => Candidacy[];
}

const DEFAULT_FILTERS: FilterState = {
  parties: [],
  genders: [],
  races: [],
  educations: [],
  occupations: [],
};

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const datasetsHook = useDatasets(auth.user, auth.isAuthenticated);
  
  const [viewMode, setViewMode] = useState<'legal' | 'analytical'>('legal');
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS);

  const setFilters = (newFilters: Partial<FilterState>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFiltersState(DEFAULT_FILTERS);
  };

  const getFilteredCandidacies = (): Candidacy[] => {
    const dataset = datasetsHook.getActiveDataset();
    if (!dataset) return [];

    return dataset.candidacies.filter((c) => {
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
  };

  const value: DataContextType = {
    // Auth
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    authLoading: auth.loading,
    signOut: auth.signOut,
    
    // Data
    datasets: datasetsHook.datasets,
    analyticalGroups: datasetsHook.analyticalGroups,
    activeDatasetId: datasetsHook.activeDatasetId,
    setActiveDatasetId: datasetsHook.setActiveDatasetId,
    dataLoading: datasetsHook.loading,
    
    // Actions
    addDataset: datasetsHook.addDataset,
    deleteDataset: datasetsHook.deleteDataset,
    addAnalyticalGroup: datasetsHook.addAnalyticalGroup,
    updateAnalyticalGroup: datasetsHook.updateAnalyticalGroup,
    deleteAnalyticalGroup: datasetsHook.deleteAnalyticalGroup,
    getActiveDataset: datasetsHook.getActiveDataset,
    refetch: datasetsHook.refetch,
    
    // UI State
    viewMode,
    setViewMode,
    filters,
    setFilters,
    resetFilters,
    getFilteredCandidacies,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

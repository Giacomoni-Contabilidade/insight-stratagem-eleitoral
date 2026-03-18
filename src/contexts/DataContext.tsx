import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { useDatasets } from '@/hooks/useDatasets';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Dataset, Candidacy, AnalyticalGroup, FilterState } from '@/types/campaign';

interface DataContextType {
  // Auth
  user: ReturnType<typeof useAuth>['user'];
  isAuthenticated: boolean;
  authLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  
  // Year filter
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  availableYears: number[];
  
  // Data
  datasets: Dataset[];
  filteredDatasets: Dataset[];
  analyticalGroups: AnalyticalGroup[];
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;
  dataLoading: boolean;
  candidaciesLoading: boolean;
  
  // Actions
  addDataset: (data: Omit<Dataset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  deleteDataset: (id: string) => Promise<void>;
  addAnalyticalGroup: (data: Omit<AnalyticalGroup, 'id'>) => Promise<string | null>;
  updateAnalyticalGroup: (id: string, updates: Partial<AnalyticalGroup>) => Promise<void>;
  deleteAnalyticalGroup: (id: string) => Promise<void>;
  getActiveDataset: () => Dataset | undefined;
  refetch: () => Promise<void>;
  loadMultipleDatasetCandidacies: (ids: string[]) => Promise<void>;
  
  // UI State
  viewMode: 'legal' | 'analytical';
  setViewMode: (mode: 'legal' | 'analytical') => void;
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  getFilteredCandidacies: () => Candidacy[];
  
  // Zero filter
  hideZeroCandidates: boolean;
  setHideZeroCandidates: (v: boolean) => void;
  filterZeroCandidates: (candidacies: Candidacy[]) => Candidacy[];
}

const DEFAULT_FILTERS: FilterState = {
  parties: [],
  genders: [],
  races: [],
  educations: [],
  occupations: [],
};

// Election years in Brazil (even years)
const ELECTION_YEARS = [2022, 2024, 2026, 2028, 2030];

const getStoredYear = (): number => {
  try {
    const stored = localStorage.getItem('selectedElectionYear');
    if (stored) return parseInt(stored, 10);
  } catch {}
  return 2024;
};

// Force clean HMR rebuild
const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const { isAdmin, roleLoading } = useUserRole(auth.user);
  const datasetsHook = useDatasets(auth.user, auth.isAuthenticated);
  
  const [selectedYear, setSelectedYearState] = useState<number>(getStoredYear);
  const [viewMode, setViewMode] = useState<'legal' | 'analytical'>('legal');
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS);
  const [hideZeroCandidates, setHideZeroCandidates] = useState(() => {
    try {
      return localStorage.getItem('hideZeroCandidates') === 'true';
    } catch { return false; }
  });

  const setSelectedYear = (year: number) => {
    setSelectedYearState(year);
    try { localStorage.setItem('selectedElectionYear', String(year)); } catch {}
    // Reset active dataset when year changes
    datasetsHook.setActiveDatasetId(null);
    setFiltersState(DEFAULT_FILTERS);
  };

  // Datasets filtered by selected year
  const filteredDatasets = datasetsHook.datasets.filter(d => d.year === selectedYear);

  // Available years from actual data
  const availableYears = [...new Set(datasetsHook.datasets.map(d => d.year))].sort();

  const handleSetHideZeroCandidates = (v: boolean) => {
    setHideZeroCandidates(v);
    try { localStorage.setItem('hideZeroCandidates', String(v)); } catch {}
  };

  const isZeroCandidate = (c: Candidacy) => c.votes === 0 && c.totalExpenses === 0 && c.costPerVote === 0;
  const filterZeroCandidates = (candidacies: Candidacy[]) =>
    hideZeroCandidates ? candidacies.filter(c => !isZeroCandidate(c)) : candidacies;

  // Reset filters when active dataset changes to prevent stale filters hiding data
  const setActiveDatasetId = (id: string | null) => {
    datasetsHook.setActiveDatasetId(id);
    setFiltersState(DEFAULT_FILTERS);
  };

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
      if (hideZeroCandidates && isZeroCandidate(c)) return false;
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
    authLoading: auth.loading || roleLoading,
    isAdmin,
    signOut: auth.signOut,
    
    // Year filter
    selectedYear,
    setSelectedYear,
    availableYears,
    
    // Data
    datasets: datasetsHook.datasets,
    filteredDatasets,
    analyticalGroups: datasetsHook.analyticalGroups,
    activeDatasetId: datasetsHook.activeDatasetId,
    setActiveDatasetId,
    dataLoading: datasetsHook.loading,
    candidaciesLoading: datasetsHook.candidaciesLoading,
    
    // Actions
    addDataset: datasetsHook.addDataset,
    deleteDataset: datasetsHook.deleteDataset,
    addAnalyticalGroup: datasetsHook.addAnalyticalGroup,
    updateAnalyticalGroup: datasetsHook.updateAnalyticalGroup,
    deleteAnalyticalGroup: datasetsHook.deleteAnalyticalGroup,
    getActiveDataset: datasetsHook.getActiveDataset,
    refetch: datasetsHook.refetch,
    loadMultipleDatasetCandidacies: datasetsHook.loadMultipleDatasetCandidacies,
    
    // UI State
    viewMode,
    setViewMode,
    filters,
    setFilters,
    resetFilters,
    getFilteredCandidacies,
    
    // Zero filter
    hideZeroCandidates,
    setHideZeroCandidates: handleSetHideZeroCandidates,
    filterZeroCandidates,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};


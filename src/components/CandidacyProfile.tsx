import React, { useState, useMemo } from 'react';
import { useCampaignStore } from '@/store/campaignStore';
import { formatCurrency, formatNumber, formatPercentage, calculatePercentile } from '@/lib/dataParser';
import { Candidacy, LEGAL_EXPENSE_CATEGORIES } from '@/types/campaign';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  User, 
  TrendingUp, 
  TrendingDown,
  ArrowUpDown,
  ChevronRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(173, 80%, 40%)',
  'hsl(199, 89%, 48%)',
];

interface ComparisonBenchmark {
  field: string;
  candidateValue: number;
  groupAvg: number;
  groupMedian: number;
  percentile: number;
  isAboveAvg: boolean;
}

export const CandidacyProfile: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidacyId, setSelectedCandidacyId] = useState<string | null>(null);
  const [compareGroup, setCompareGroup] = useState<'all' | 'party' | 'gender'>('all');
  
  const getFilteredCandidacies = useCampaignStore((s) => s.getFilteredCandidacies);
  const viewMode = useCampaignStore((s) => s.viewMode);
  const analyticalGroups = useCampaignStore((s) => s.analyticalGroups);
  
  const candidacies = getFilteredCandidacies();
  
  // Filter by search
  const filteredCandidacies = useMemo(() => {
    if (!searchTerm) return candidacies;
    const term = searchTerm.toLowerCase();
    return candidacies.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.party.toLowerCase().includes(term)
    );
  }, [candidacies, searchTerm]);
  
  const selectedCandidacy = useMemo(
    () => candidacies.find((c) => c.id === selectedCandidacyId),
    [candidacies, selectedCandidacyId]
  );
  
  // Get comparison group
  const comparisonGroup = useMemo(() => {
    if (!selectedCandidacy) return candidacies;
    if (compareGroup === 'party') {
      return candidacies.filter((c) => c.party === selectedCandidacy.party);
    }
    if (compareGroup === 'gender') {
      return candidacies.filter((c) => c.gender === selectedCandidacy.gender);
    }
    return candidacies;
  }, [candidacies, selectedCandidacy, compareGroup]);
  
  // Calculate benchmarks
  const benchmarks: ComparisonBenchmark[] = useMemo(() => {
    if (!selectedCandidacy || comparisonGroup.length === 0) return [];
    
    const fields = [
      { field: 'Votos', getValue: (c: Candidacy) => c.votes },
      { field: 'Total de Gastos', getValue: (c: Candidacy) => c.totalExpenses },
      { field: 'Receita Total', getValue: (c: Candidacy) => c.totalRevenue },
      { field: 'Saldo', getValue: (c: Candidacy) => c.balance },
      { field: 'Custo por Voto', getValue: (c: Candidacy) => c.costPerVote },
    ];
    
    return fields.map(({ field, getValue }) => {
      const candidateValue = getValue(selectedCandidacy);
      const groupValues = comparisonGroup.map(getValue);
      const groupAvg = groupValues.reduce((a, b) => a + b, 0) / groupValues.length;
      const sortedValues = [...groupValues].sort((a, b) => a - b);
      const mid = Math.floor(sortedValues.length / 2);
      const groupMedian = sortedValues.length % 2 
        ? sortedValues[mid] 
        : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
      const percentile = calculatePercentile(candidateValue, groupValues);
      
      return {
        field,
        candidateValue,
        groupAvg,
        groupMedian,
        percentile,
        isAboveAvg: candidateValue > groupAvg,
      };
    });
  }, [selectedCandidacy, comparisonGroup]);
  
  // Expense breakdown for radar chart
  const expenseComparison = useMemo(() => {
    if (!selectedCandidacy) return [];
    
    if (viewMode === 'analytical') {
      return analyticalGroups.slice(0, 6).map((group) => {
        const candidateValue = group.categories.reduce(
          (sum, cat) => sum + (selectedCandidacy.expenses[cat] || 0), 0
        );
        const groupAvg = comparisonGroup.reduce((sum, c) => {
          return sum + group.categories.reduce((catSum, cat) => catSum + (c.expenses[cat] || 0), 0);
        }, 0) / comparisonGroup.length;
        
        return {
          category: group.name,
          candidato: candidateValue,
          grupo: groupAvg,
        };
      });
    }
    
    // Top categories for legal view
    const categoryTotals = LEGAL_EXPENSE_CATEGORIES.map((cat) => ({
      cat,
      total: candidacies.reduce((sum, c) => sum + (c.expenses[cat] || 0), 0),
    }));
    
    const topCategories = categoryTotals
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    
    return topCategories.map(({ cat }) => {
      const candidateValue = selectedCandidacy.expenses[cat] || 0;
      const groupAvg = comparisonGroup.reduce(
        (sum, c) => sum + (c.expenses[cat] || 0), 0
      ) / comparisonGroup.length;
      
      return {
        category: cat.substring(0, 20) + (cat.length > 20 ? '...' : ''),
        candidato: candidateValue,
        grupo: groupAvg,
      };
    });
  }, [selectedCandidacy, comparisonGroup, viewMode, analyticalGroups, candidacies]);
  
  if (candidacies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <User className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum dado disponível</h3>
        <p className="text-muted-foreground text-sm">
          Importe um dataset para analisar candidaturas.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Perfil de Candidatura</h1>
        <p className="text-muted-foreground text-sm">
          Análise individual com benchmark contra grupo de comparação
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate Selection */}
        <div className="glass-panel rounded-xl p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar candidatura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-1">
            {filteredCandidacies.slice(0, 50).map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCandidacyId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCandidacyId === c.id
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="truncate">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.party}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </div>
              </button>
            ))}
            {filteredCandidacies.length > 50 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                +{filteredCandidacies.length - 50} candidaturas
              </p>
            )}
          </div>
        </div>
        
        {/* Profile Content */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCandidacy ? (
            <>
              {/* Header */}
              <div className="glass-panel rounded-xl p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedCandidacy.name}</h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="chip chip-primary">{selectedCandidacy.party}</span>
                      <span className="chip bg-muted text-muted-foreground">{selectedCandidacy.gender}</span>
                      <span className="chip bg-muted text-muted-foreground">{selectedCandidacy.race}</span>
                      <span className="chip bg-muted text-muted-foreground">{selectedCandidacy.education}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{selectedCandidacy.occupation}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="metric-label">Comparar com</p>
                    <Select value={compareGroup} onValueChange={(v: any) => setCompareGroup(v)}>
                      <SelectTrigger className="w-36 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="party">Mesmo partido</SelectItem>
                        <SelectItem value="gender">Mesmo gênero</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {comparisonGroup.length} candidaturas
                    </p>
                  </div>
                </div>
                
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Votos</p>
                    <p className="text-xl font-bold">{formatNumber(selectedCandidacy.votes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Gastos</p>
                    <p className="text-xl font-bold">{formatCurrency(selectedCandidacy.totalExpenses)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo/Voto</p>
                    <p className="text-xl font-bold">{formatCurrency(selectedCandidacy.costPerVote)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className={`text-xl font-bold ${selectedCandidacy.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(selectedCandidacy.balance)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Benchmark Table */}
              <div className="glass-panel rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">Benchmark vs grupo de comparação</h3>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Indicador</th>
                        <th className="text-right">Valor</th>
                        <th className="text-right">Média do grupo</th>
                        <th className="text-right">Mediana</th>
                        <th className="text-right">Percentil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarks.map((b) => (
                        <tr key={b.field}>
                          <td className="font-medium">{b.field}</td>
                          <td className="text-right font-mono">{formatCurrency(b.candidateValue)}</td>
                          <td className="text-right font-mono text-muted-foreground">
                            {formatCurrency(b.groupAvg)}
                          </td>
                          <td className="text-right font-mono text-muted-foreground">
                            {formatCurrency(b.groupMedian)}
                          </td>
                          <td className="text-right">
                            <span className={`inline-flex items-center gap-1 ${
                              b.percentile > 50 ? 'text-success' : 'text-warning'
                            }`}>
                              {b.isAboveAvg 
                                ? <TrendingUp className="w-3 h-3" /> 
                                : <TrendingDown className="w-3 h-3" />
                              }
                              {b.percentile.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Expense Comparison Chart */}
              <div className="glass-panel rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">
                  Perfil de gastos vs média do grupo ({viewMode === 'analytical' ? 'Grupos Analíticos' : 'Categorias Legais'})
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={expenseComparison}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis 
                      dataKey="category" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    />
                    <PolarRadiusAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Radar
                      name={selectedCandidacy.name.substring(0, 20)}
                      dataKey="candidato"
                      stroke={CHART_COLORS[0]}
                      fill={CHART_COLORS[0]}
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="Média do grupo"
                      dataKey="grupo"
                      stroke={CHART_COLORS[1]}
                      fill={CHART_COLORS[1]}
                      fillOpacity={0.2}
                    />
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="glass-panel rounded-xl p-12 text-center">
              <User className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-medium mb-2">Selecione uma candidatura</h3>
              <p className="text-sm text-muted-foreground">
                Use a busca ao lado para encontrar e selecionar uma candidatura para análise.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

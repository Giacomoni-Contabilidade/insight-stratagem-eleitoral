import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatNumber, formatPercentage, calculateMedian } from '@/lib/dataParser';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { ArrowRight, Users, Wallet, Vote, Target } from 'lucide-react';

const CHART_COLORS = [
  'hsl(173, 80%, 40%)',
  'hsl(199, 89%, 48%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
];

type GroupByField = 'party' | 'gender' | 'race' | 'education';

const GROUP_OPTIONS: { value: GroupByField; label: string }[] = [
  { value: 'party', label: 'Partido' },
  { value: 'gender', label: 'Gênero' },
  { value: 'race', label: 'Raça/Cor' },
  { value: 'education', label: 'Escolaridade' },
];

interface GroupStats {
  name: string;
  count: number;
  totalVotes: number;
  totalExpenses: number;
  totalFinancialExpenses: number;
  totalEstimatedDonations: number;
  avgCostPerVote: number;
  medianCostPerVote: number;
  financialPct: number;
}

export const GroupComparison: React.FC = () => {
  const [groupBy, setGroupBy] = useState<GroupByField>('gender');
  
  
  const { getFilteredCandidacies, analyticalGroups, viewMode } = useData();
  const candidacies = getFilteredCandidacies();
  
  // Group candidacies by selected field (must be before early return for hooks order)
  const groups = useMemo(() => candidacies.reduce((acc, c) => {
    const key = c[groupBy];
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, typeof candidacies>), [candidacies, groupBy]);
  
  const groupStats: GroupStats[] = useMemo(() => Object.entries(groups).map(([name, members]) => {
    const totalVotes = members.reduce((sum, m) => sum + m.votes, 0);
    const totalExpenses = members.reduce((sum, m) => sum + m.totalExpenses, 0);
    const totalFinancialExpenses = members.reduce((sum, m) => sum + m.financialExpenses, 0);
    const totalEstimatedDonations = members.reduce((sum, m) => sum + m.estimatedDonations, 0);
    const costPerVotes = members.filter(m => m.votes > 0).map((m) => m.costPerVote);
    const financialPct = totalExpenses > 0 ? totalFinancialExpenses / totalExpenses : 0;
    return {
      name, count: members.length, totalVotes, totalExpenses, totalFinancialExpenses,
      totalEstimatedDonations,
      avgCostPerVote: totalVotes > 0 ? totalExpenses / totalVotes : 0,
      medianCostPerVote: calculateMedian(costPerVotes), financialPct,
    };
  }).sort((a, b) => b.count - a.count), [groups]);
  
  const displayGroups = useMemo(() => groupStats.slice(0, 5), [groupStats]);
  
  const radarData = useMemo(() => {
    if (viewMode === 'analytical' && analyticalGroups.length > 0) {
      return analyticalGroups.map((ag) => {
        const data: Record<string, any> = { category: ag.name };
        displayGroups.forEach((group) => {
          const groupCandidacies = candidacies.filter((c) => c[groupBy] === group.name);
          const total = groupCandidacies.reduce((sum, c) =>
            sum + ag.categories.reduce((catSum, cat) => catSum + (c.expenses[cat] || 0), 0), 0);
          data[group.name] = total;
        });
        return data;
      });
    }
    const categoryTotals = new Map<string, number>();
    candidacies.forEach((c) => {
      Object.entries(c.expenses).forEach(([cat, val]) => {
        categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + val);
      });
    });
    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat]) => cat);
    return topCategories.map((cat) => {
      const data: Record<string, any> = { category: cat.length > 20 ? cat.slice(0, 20) + '…' : cat };
      displayGroups.forEach((group) => {
        const groupCandidacies = candidacies.filter((c) => c[groupBy] === group.name);
        const total = groupCandidacies.reduce((sum, c) => sum + (c.expenses[cat as keyof typeof c.expenses] || 0), 0);
        data[group.name] = total;
      });
      return data;
    });
  }, [viewMode, analyticalGroups, displayGroups, candidacies, groupBy]);

  if (candidacies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum dado disponível</h3>
        <p className="text-muted-foreground text-sm">
          Importe um dataset para comparar grupos.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comparação de grupos</h1>
          <p className="text-muted-foreground text-sm">
            Compare indicadores entre diferentes segmentos de candidaturas
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Agrupar por</Label>
            <Select value={groupBy} onValueChange={(v) => {
              setGroupBy(v as GroupByField);
            }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayGroups.map((group, i) => (
          <div 
            key={group.name}
            className="stat-card cursor-pointer"
            style={{ borderLeft: `4px solid ${CHART_COLORS[i % CHART_COLORS.length]}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold truncate">{group.name}</h3>
              <span className="chip chip-primary">{group.count}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Votos</p>
                <p className="font-mono font-medium">{formatNumber(group.totalVotes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gastos</p>
                <p className="font-mono font-medium">{formatCurrency(group.totalExpenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo/voto</p>
                <p className="font-mono font-medium">{formatCurrency(group.avgCostPerVote)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">% em dinheiro</p>
                <p className="font-mono font-medium">{formatPercentage(group.financialPct)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Votes Comparison */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Comparativo de votos e gastos</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={displayGroups}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) + '...' : v}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [
                  name === 'totalVotes' ? formatNumber(value) : formatCurrency(value),
                  name === 'totalVotes' ? 'Votos' : 'Gastos'
                ]}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="totalVotes" name="Votos" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="totalExpenses" name="Gastos" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Radar Chart - Expense Distribution */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">
            Perfil de gastos ({viewMode === 'analytical' ? 'por grupo analítico' : 'por categoria legal'})
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis 
                dataKey="category" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <PolarRadiusAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
              />
              {displayGroups.map((group, i) => (
                <Radar
                  key={group.name}
                  name={group.name}
                  dataKey={group.name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.2}
                />
              ))}
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
      </div>
      
      {/* Detailed Table */}
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-4">Tabela comparativa completa</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Grupo</th>
                <th className="text-right">Candidaturas</th>
                <th className="text-right">Total Votos</th>
                <th className="text-right">Total Gastos</th>
                <th className="text-right">Desp. Financeiras</th>
                <th className="text-right">Doações Estim.</th>
                <th className="text-right">Custo/Voto (média)</th>
                <th className="text-right">Custo/Voto (mediana)</th>
              </tr>
            </thead>
            <tbody>
              {groupStats.map((group, i) => (
                <tr key={group.name}>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {group.name}
                    </div>
                  </td>
                  <td className="text-right font-mono">{formatNumber(group.count)}</td>
                  <td className="text-right font-mono">{formatNumber(group.totalVotes)}</td>
                  <td className="text-right font-mono">{formatCurrency(group.totalExpenses)}</td>
                  <td className="text-right font-mono">{formatCurrency(group.totalFinancialExpenses)}</td>
                  <td className="text-right font-mono">{formatCurrency(group.totalEstimatedDonations)}</td>
                  <td className="text-right font-mono">{formatCurrency(group.avgCostPerVote)}</td>
                  <td className="text-right font-mono">{formatCurrency(group.medianCostPerVote)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useCampaignStore } from '@/store/campaignStore';
import { formatCurrency, formatNumber, formatPercentage, calculateMedian } from '@/lib/dataParser';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Wallet, 
  Vote, 
  Target,
  DollarSign,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(173, 80%, 40%)',
  'hsl(199, 89%, 48%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 65%, 60%)',
  'hsl(330, 80%, 60%)',
];

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, trend, trendValue }) => (
  <div className="stat-card">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="metric-label">{title}</p>
        <p className="metric-value">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        {icon}
      </div>
    </div>
    {trend && trendValue && (
      <div className={`flex items-center gap-1 mt-3 text-xs ${
        trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
      }`}>
        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{trendValue}</span>
      </div>
    )}
  </div>
);

export const Dashboard: React.FC = () => {
  const getFilteredCandidacies = useCampaignStore((s) => s.getFilteredCandidacies);
  const getActiveDataset = useCampaignStore((s) => s.getActiveDataset);
  const viewMode = useCampaignStore((s) => s.viewMode);
  const analyticalGroups = useCampaignStore((s) => s.analyticalGroups);
  
  const dataset = getActiveDataset();
  const candidacies = getFilteredCandidacies();
  
  if (!dataset || candidacies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum dado disponível</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Importe um dataset para visualizar o dashboard de análise.
        </p>
      </div>
    );
  }
  
  // Calculate KPIs
  const totalCandidacies = candidacies.length;
  const totalVotes = candidacies.reduce((sum, c) => sum + c.votes, 0);
  const totalExpenses = candidacies.reduce((sum, c) => sum + c.totalExpenses, 0);
  const totalRevenue = candidacies.reduce((sum, c) => sum + c.totalRevenue, 0);
  const avgCostPerVote = totalVotes > 0 ? totalExpenses / totalVotes : 0;
  const medianCostPerVote = calculateMedian(candidacies.filter(c => c.votes > 0).map((c) => c.costPerVote));
  
  // Group by party
  const partyData = candidacies.reduce((acc, c) => {
    if (!acc[c.party]) {
      acc[c.party] = { party: c.party, count: 0, votes: 0, expenses: 0 };
    }
    acc[c.party].count++;
    acc[c.party].votes += c.votes;
    acc[c.party].expenses += c.totalExpenses;
    return acc;
  }, {} as Record<string, { party: string; count: number; votes: number; expenses: number }>);
  
  const partyChartData = Object.values(partyData)
    .sort((a, b) => b.expenses - a.expenses)
    .slice(0, 10);
  
  // Group by gender
  const genderData = candidacies.reduce((acc, c) => {
    if (!acc[c.gender]) {
      acc[c.gender] = { name: c.gender, value: 0, votes: 0, expenses: 0 };
    }
    acc[c.gender].value++;
    acc[c.gender].votes += c.votes;
    acc[c.gender].expenses += c.totalExpenses;
    return acc;
  }, {} as Record<string, { name: string; value: number; votes: number; expenses: number }>);
  
  const genderChartData = Object.values(genderData);
  
  // Expense breakdown (legal categories or analytical groups)
  const expenseBreakdown = viewMode === 'legal'
    ? Object.entries(
        candidacies.reduce((acc, c) => {
          Object.entries(c.expenses).forEach(([cat, val]) => {
            acc[cat] = (acc[cat] || 0) + val;
          });
          return acc;
        }, {} as Record<string, number>)
      )
        .filter(([_, val]) => val > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, value]) => ({ name: name.substring(0, 30) + (name.length > 30 ? '...' : ''), value, fullName: name }))
    : analyticalGroups.map((group) => {
        const value = candidacies.reduce((sum, c) => {
          return sum + group.categories.reduce((catSum, cat) => catSum + (c.expenses[cat] || 0), 0);
        }, 0);
        return { name: group.name, value, color: group.color };
      }).filter(g => g.value > 0).sort((a, b) => b.value - a.value);
  
  // Efficiency ranking
  const efficiencyRanking = candidacies
    .filter((c) => c.votes > 0)
    .map((c) => ({
      name: c.name.substring(0, 25) + (c.name.length > 25 ? '...' : ''),
      party: c.party,
      costPerVote: c.costPerVote,
      votes: c.votes,
    }))
    .sort((a, b) => a.costPerVote - b.costPerVote)
    .slice(0, 10);
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dataset.name}</h1>
          <p className="text-muted-foreground text-sm">
            {dataset.position} • {dataset.state} • {dataset.year}
          </p>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de candidaturas"
          value={formatNumber(totalCandidacies)}
          icon={<Users className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Total de votos"
          value={formatNumber(totalVotes)}
          icon={<Vote className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Total de gastos"
          value={formatCurrency(totalExpenses)}
          icon={<Wallet className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Custo médio por voto"
          value={formatCurrency(avgCostPerVote)}
          subtitle={`Mediana: ${formatCurrency(medianCostPerVote)}`}
          icon={<Target className="w-5 h-5 text-primary" />}
        />
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Party */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Gastos por partido (Top 10)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={partyChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number" 
                tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis 
                type="category" 
                dataKey="party" 
                width={60}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Gastos']}
              />
              <Bar dataKey="expenses" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Gender Distribution */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Distribuição por gênero</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={genderChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {genderChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [formatNumber(value), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">
            Distribuição de gastos ({viewMode === 'legal' ? 'Categorias Legais' : 'Grupos Analíticos'})
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expenseBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number"
                tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={180}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Total']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {expenseBreakdown.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={(entry as any).color || CHART_COLORS[index % CHART_COLORS.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Efficiency Ranking */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Ranking de eficiência (menor custo por voto)</h3>
          <div className="overflow-y-auto max-h-[300px] scrollbar-thin">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Candidatura</th>
                  <th>Partido</th>
                  <th className="text-right">Custo/Voto</th>
                </tr>
              </thead>
              <tbody>
                {efficiencyRanking.map((c, i) => (
                  <tr key={i}>
                    <td className="font-mono text-muted-foreground">{i + 1}</td>
                    <td className="font-medium">{c.name}</td>
                    <td><span className="chip chip-primary">{c.party}</span></td>
                    <td className="text-right font-mono text-sm">{formatCurrency(c.costPerVote)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

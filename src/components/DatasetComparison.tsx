import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Dataset, Candidacy } from '@/types/campaign';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Search, BarChart3, Users, DollarSign, Vote, TrendingUp, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (v: number) => v.toLocaleString('pt-BR');

interface DatasetMetrics {
  dataset: Dataset;
  totalCandidacies: number;
  totalVotes: number;
  totalExpenses: number;
  totalFinancial: number;
  totalDonations: number;
  avgCostPerVote: number;
  medianCostPerVote: number;
  avgVotes: number;
  avgExpenses: number;
  electedCount: number;
  electedPct: number;
}

const computeMetrics = (ds: Dataset): DatasetMetrics => {
  const cands = ds.candidacies || [];
  const n = cands.length;
  const totalVotes = cands.reduce((s, c) => s + c.votes, 0);
  const totalExpenses = cands.reduce((s, c) => s + c.totalExpenses, 0);
  const totalFinancial = cands.reduce((s, c) => s + c.financialExpenses, 0);
  const totalDonations = cands.reduce((s, c) => s + c.estimatedDonations, 0);
  const cpvs = cands.map((c) => c.costPerVote).filter((v) => v > 0 && isFinite(v)).sort((a, b) => a - b);
  const median = cpvs.length === 0
    ? 0
    : cpvs.length % 2 === 1
      ? cpvs[Math.floor(cpvs.length / 2)]
      : (cpvs[cpvs.length / 2 - 1] + cpvs[cpvs.length / 2]) / 2;
  const avgCpv = cpvs.length > 0 ? cpvs.reduce((s, v) => s + v, 0) / cpvs.length : 0;

  const electedCount = cands.filter(c => c.elected).length;

  return {
    dataset: ds,
    totalCandidacies: n,
    totalVotes,
    totalExpenses,
    totalFinancial,
    totalDonations,
    avgCostPerVote: avgCpv,
    medianCostPerVote: median,
    avgVotes: n > 0 ? totalVotes / n : 0,
    avgExpenses: n > 0 ? totalExpenses / n : 0,
    electedCount,
    electedPct: n > 0 ? electedCount / n : 0,
  };
};

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
];

export const DatasetComparison: React.FC = () => {
  const { datasets, loadMultipleDatasetCandidacies, candidaciesLoading, filterZeroCandidates } = useData();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hasExplicitSelection, setHasExplicitSelection] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');

  // Auto-select all only if user hasn't made an explicit selection
  const effectiveIds = hasExplicitSelection ? selectedIds : datasets.map((d) => d.id);
  const selectedDatasets = datasets.filter((d) => effectiveIds.includes(d.id));

  // Load candidacies for all selected datasets
  useEffect(() => {
    if (effectiveIds.length > 0) {
      loadMultipleDatasetCandidacies(effectiveIds);
    }
  }, [effectiveIds.join(','), loadMultipleDatasetCandidacies]);

  const metrics = useMemo(() => selectedDatasets.map(ds => computeMetrics({ ...ds, candidacies: filterZeroCandidates(ds.candidacies || []) })), [selectedDatasets, filterZeroCandidates]);

  const toggleDataset = (id: string) => {
    setHasExplicitSelection(true);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Cross-candidacy search
  const crossCandidates = useMemo(() => {
    if (!candidateSearch.trim() || candidateSearch.trim().length < 3) return [];
    const term = candidateSearch.toLowerCase();
    const map = new Map<string, { name: string; entries: { dataset: Dataset; candidacy: Candidacy }[] }>();

    for (const ds of selectedDatasets) {
      for (const c of filterZeroCandidates(ds.candidacies || [])) {
        if (!c.name.toLowerCase().includes(term)) continue;
        const key = c.name.toLowerCase().trim();
        if (!map.has(key)) map.set(key, { name: c.name, entries: [] });
        map.get(key)!.entries.push({ dataset: ds, candidacy: c });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.entries.length - a.entries.length);
  }, [candidateSearch, selectedDatasets]);

  // Chart data for aggregate comparison
  const barChartData = useMemo(
    () =>
      metrics.map((m, i) => ({
        name: m.dataset.name.length > 20 ? m.dataset.name.slice(0, 20) + '…' : m.dataset.name,
        'Total Votos': m.totalVotes,
        'Total Despesas': m.totalExpenses,
        'Candidaturas': m.totalCandidacies,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [metrics]
  );

  const radarData = useMemo(() => {
    if (metrics.length === 0) return [];
    const maxVotes = Math.max(...metrics.map((m) => m.avgVotes)) || 1;
    const maxExpenses = Math.max(...metrics.map((m) => m.avgExpenses)) || 1;
    const maxCpv = Math.max(...metrics.map((m) => m.avgCostPerVote)) || 1;
    const maxCands = Math.max(...metrics.map((m) => m.totalCandidacies)) || 1;
    const maxFinPct = Math.max(
      ...metrics.map((m) => (m.totalExpenses > 0 ? m.totalFinancial / m.totalExpenses : 0))
    ) || 1;

    return [
      { metric: 'Votos Médios', ...Object.fromEntries(metrics.map((m) => [m.dataset.name, (m.avgVotes / maxVotes) * 100])) },
      { metric: 'Despesa Média', ...Object.fromEntries(metrics.map((m) => [m.dataset.name, (m.avgExpenses / maxExpenses) * 100])) },
      { metric: 'Custo/Voto', ...Object.fromEntries(metrics.map((m) => [m.dataset.name, (m.avgCostPerVote / maxCpv) * 100])) },
      { metric: 'Candidaturas', ...Object.fromEntries(metrics.map((m) => [m.dataset.name, (m.totalCandidacies / maxCands) * 100])) },
      { metric: '% Financeiro', ...Object.fromEntries(metrics.map((m) => [m.dataset.name, ((m.totalExpenses > 0 ? m.totalFinancial / m.totalExpenses : 0) / maxFinPct) * 100])) },
    ];
  }, [metrics]);

  if (datasets.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <BarChart3 className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">Comparação entre Datasets</h2>
        <p className="text-muted-foreground max-w-md">
          Você precisa ter pelo menos <strong>2 datasets</strong> importados para usar esta funcionalidade.
          Atualmente você possui {datasets.length} dataset{datasets.length !== 1 ? 's' : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Comparação entre Datasets</h2>
        <p className="text-muted-foreground mt-1">
          Compare métricas agregadas e pesquise candidaturas entre diferentes datasets.
        </p>
      </div>

      {/* Dataset Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Selecionar Datasets ({selectedDatasets.length} selecionados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={() => {
              setHasExplicitSelection(true);
              setSelectedIds(datasets.map(d => d.id));
            }}>
              Marcar tudo
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setHasExplicitSelection(true);
              setSelectedIds([]);
            }}>
              Desmarcar tudo
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setHasExplicitSelection(true);
              const allIds = datasets.map(d => d.id);
              setSelectedIds(allIds.filter(id => !effectiveIds.includes(id)));
            }}>
              Inverter
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {datasets.map((ds) => (
              <label
                key={ds.id}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all',
                  effectiveIds.includes(ds.id)
                    ? 'bg-primary/10 border-primary text-foreground'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                )}
              >
                <Checkbox
                  checked={effectiveIds.includes(ds.id)}
                  onCheckedChange={() => toggleDataset(ds.id)}
                />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{ds.name}</span>
                  <span className="text-xs opacity-70">
                    {ds.year} · {ds.state} · {ds.candidacies?.length || 0} candidaturas
                  </span>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aggregate Metrics Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Métricas Agregadas
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead className="text-right">Candidaturas</TableHead>
                <TableHead className="text-right">Total Votos</TableHead>
                <TableHead className="text-right">Total Despesas</TableHead>
                <TableHead className="text-right">Despesas Financeiras</TableHead>
                <TableHead className="text-right">Doações Estimadas</TableHead>
                <TableHead className="text-right">Custo/Voto Médio</TableHead>
                <TableHead className="text-right">Custo/Voto Mediano</TableHead>
                <TableHead className="text-right">Eleitos</TableHead>
                <TableHead className="text-right">% Eleitos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m, i) => (
                <TableRow key={m.dataset.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <div>
                        <span className="font-medium">{m.dataset.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {m.dataset.year} · {m.dataset.state} · {m.dataset.position}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(m.totalCandidacies)}</TableCell>
                  <TableCell className="text-right">{formatNumber(m.totalVotes)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(m.totalExpenses)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(m.totalFinancial)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(m.totalDonations)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(m.avgCostPerVote)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(m.medianCostPerVote)}</TableCell>
                  <TableCell className="text-right">{formatNumber(m.electedCount)}</TableCell>
                  <TableCell className="text-right">{(m.electedPct * 100).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Despesas Totais por Dataset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="Total Despesas" radius={[6, 6, 0, 0]}>
                  {barChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        {metrics.length >= 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Vote className="w-4 h-4" />
                Perfil Comparativo (normalizado)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" fontSize={11} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} />
                  {selectedDatasets.map((ds, i) => (
                    <Radar
                      key={ds.id}
                      name={ds.name}
                      dataKey={ds.name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Cross-candidacy search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Pesquisa Cruzada de Candidaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Busque um candidato para ver sua presença e evolução em diferentes datasets.
          </p>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome do candidato (mín. 3 caracteres)..."
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {crossCandidates.length > 0 && (
            <div className="space-y-4 mt-4">
              {crossCandidates.slice(0, 10).map((group) => (
                <Card key={group.name} className="border border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {group.name}
                      <Badge variant="secondary" className="text-xs">
                        {group.entries.length} dataset{group.entries.length > 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dataset</TableHead>
                          <TableHead>Partido</TableHead>
                          <TableHead className="text-right">Votos</TableHead>
                          <TableHead className="text-right">Despesa Total</TableHead>
                          <TableHead className="text-right">Custo/Voto</TableHead>
                          <TableHead className="text-right">Eleito</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.entries.map((entry) => (
                          <TableRow key={`${entry.dataset.id}-${entry.candidacy.id}`}>
                            <TableCell>
                              <span className="font-medium text-sm">{entry.dataset.name}</span>
                              <div className="text-xs text-muted-foreground">
                                {entry.dataset.year} · {entry.dataset.state}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.candidacy.party}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatNumber(entry.candidacy.votes)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.candidacy.totalExpenses)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.candidacy.costPerVote)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={entry.candidacy.elected ? 'default' : 'secondary'}>
                                {entry.candidacy.elected ? 'Sim' : 'Não'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {candidateSearch.trim().length >= 3 && crossCandidates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum candidato encontrado com "{candidateSearch}" nos datasets selecionados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

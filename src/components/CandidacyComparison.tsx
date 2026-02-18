import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Candidacy } from '@/types/campaign';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/dataParser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
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
import {
  UserPlus,
  X,
  Search,
  Users,
  TrendingUp,
  Wallet,
  Vote,
  Target,
  AlertCircle,
} from 'lucide-react';

const CHART_COLORS = [
  'hsl(200, 60%, 40%)',   // Blue
  'hsl(149, 50%, 38%)',   // Green
  'hsl(43, 85%, 50%)',    // Gold
  'hsl(17, 70%, 55%)',    // Coral
  'hsl(270, 50%, 55%)',   // Purple
  'hsl(6, 65%, 50%)',     // Red
];

const MAX_COMPARISON = 6;

export const CandidacyComparison: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterParty, setFilterParty] = useState<string>('');

  const { getFilteredCandidacies, getActiveDataset, activeDatasetId } = useData();
  const candidacies = getFilteredCandidacies();
  const activeDataset = getActiveDataset();

  // Reset selection when dataset changes
  useEffect(() => {
    setSelectedIds([]);
    setSearchTerm('');
    setFilterParty('');
  }, [activeDatasetId]);

  // Get unique parties
  const parties = useMemo(() => {
    const partySet = new Set(candidacies.map((c) => c.party));
    return Array.from(partySet).sort();
  }, [candidacies]);

  // Filter candidacies for selection
  const filteredCandidacies = useMemo(() => {
    return candidacies.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesParty = !filterParty || c.party === filterParty;
      return matchesSearch && matchesParty;
    });
  }, [candidacies, searchTerm, filterParty]);

  // Get selected candidacies
  const selectedCandidacies = useMemo(() => {
    return candidacies.filter((c) => selectedIds.includes(c.id));
  }, [candidacies, selectedIds]);

  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else if (selectedIds.length < MAX_COMPARISON) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRemove = (id: string) => {
    setSelectedIds(selectedIds.filter((i) => i !== id));
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  // Prepare comparison chart data
  const comparisonData = useMemo(() => {
    if (selectedCandidacies.length === 0) return [];

    return [
      {
        metric: 'Votos',
        ...selectedCandidacies.reduce((acc, c, i) => {
          acc[c.name] = c.votes;
          return acc;
        }, {} as Record<string, number>),
      },
      {
        metric: 'Total Gastos',
        ...selectedCandidacies.reduce((acc, c) => {
          acc[c.name] = c.totalExpenses;
          return acc;
        }, {} as Record<string, number>),
      },
      {
        metric: 'Desp. Financeiras',
        ...selectedCandidacies.reduce((acc, c) => {
          acc[c.name] = c.financialExpenses;
          return acc;
        }, {} as Record<string, number>),
      },
      {
        metric: 'Doações Estim.',
        ...selectedCandidacies.reduce((acc, c) => {
          acc[c.name] = c.estimatedDonations;
          return acc;
        }, {} as Record<string, number>),
      },
    ];
  }, [selectedCandidacies]);

  // Prepare radar data for normalized comparison
  const radarData = useMemo(() => {
    if (selectedCandidacies.length === 0) return [];

    const maxVotes = Math.max(...selectedCandidacies.map((c) => c.votes), 1);
    const maxExpenses = Math.max(...selectedCandidacies.map((c) => c.totalExpenses), 1);
    const maxCostPerVote = Math.max(...selectedCandidacies.map((c) => c.costPerVote), 1);
    const maxFinancialPct = 1;

    return [
      { metric: 'Votos', fullMark: 100 },
      { metric: 'Total Gastos', fullMark: 100 },
      { metric: 'Custo/Voto', fullMark: 100 },
      { metric: '% Financeiro', fullMark: 100 },
    ].map((item) => {
      const result: Record<string, number | string> = { metric: item.metric, fullMark: item.fullMark };
      selectedCandidacies.forEach((c) => {
        switch (item.metric) {
          case 'Votos':
            result[c.name] = (c.votes / maxVotes) * 100;
            break;
          case 'Total Gastos':
            result[c.name] = (c.totalExpenses / maxExpenses) * 100;
            break;
          case 'Custo/Voto':
            result[c.name] = (c.costPerVote / maxCostPerVote) * 100;
            break;
          case '% Financeiro':
            result[c.name] = c.financialExpensesPct * 100;
            break;
        }
      });
      return result;
    });
  }, [selectedCandidacies]);

  // Calculate comparison stats
  const comparisonStats = useMemo(() => {
    if (selectedCandidacies.length < 2) return null;

    const votes = selectedCandidacies.map((c) => c.votes);
    const expenses = selectedCandidacies.map((c) => c.totalExpenses);
    const costPerVote = selectedCandidacies.map((c) => c.costPerVote);

    const maxVotesIdx = votes.indexOf(Math.max(...votes));
    const minCostIdx = costPerVote.indexOf(Math.min(...costPerVote.filter((v) => v > 0)));
    const maxExpensesIdx = expenses.indexOf(Math.max(...expenses));

    return {
      mostVotes: selectedCandidacies[maxVotesIdx],
      lowestCost: selectedCandidacies[minCostIdx >= 0 ? minCostIdx : 0],
      highestExpenses: selectedCandidacies[maxExpensesIdx],
      votesRange: Math.max(...votes) - Math.min(...votes),
      expensesRange: Math.max(...expenses) - Math.min(...expenses),
    };
  }, [selectedCandidacies]);

  if (!activeDataset) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhum dataset ativo</h2>
        <p className="text-muted-foreground">
          Importe ou selecione um dataset para comparar candidaturas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Comparar Candidaturas</h2>
          <p className="text-sm text-muted-foreground">
            Selecione até {MAX_COMPARISON} candidaturas para análise comparativa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Selecionar Candidaturas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filter */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterParty || 'all'} onValueChange={(v) => setFilterParty(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por partido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os partidos</SelectItem>
                  {parties.map((party) => (
                    <SelectItem key={party} value={party}>
                      {party}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected badges */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedCandidacies.map((c, i) => (
                  <Badge
                    key={c.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                    style={{ borderLeftColor: CHART_COLORS[i], borderLeftWidth: 3 }}
                  >
                    {c.name}
                    <button
                      onClick={() => handleRemove(c.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={handleClearAll}>
                  Limpar
                </Button>
              </div>
            )}

            {/* Candidacy list */}
            <div className="max-h-80 overflow-y-auto space-y-1 scrollbar-thin">
              {filteredCandidacies.slice(0, 50).map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const idx = selectedIds.indexOf(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    disabled={!isSelected && selectedIds.length >= MAX_COMPARISON}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    } ${
                      !isSelected && selectedIds.length >= MAX_COMPARISON
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[idx] }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.party} • {formatNumber(c.votes)} votos
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredCandidacies.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando 50 de {filteredCandidacies.length}. Refine sua busca.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comparison Results */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCandidacies.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Selecione candidaturas à esquerda para comparar
              </p>
            </Card>
          ) : (
            <>
              {/* Quick Stats */}
              {comparisonStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Vote className="w-4 h-4" />
                        Mais votado
                      </div>
                      <p className="font-semibold truncate">{comparisonStats.mostVotes.name}</p>
                      <p className="text-lg font-bold text-primary">
                        {formatNumber(comparisonStats.mostVotes.votes)} votos
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Target className="w-4 h-4" />
                        Menor custo/voto
                      </div>
                      <p className="font-semibold truncate">{comparisonStats.lowestCost.name}</p>
                      <p className="text-lg font-bold text-success">
                        {formatCurrency(comparisonStats.lowestCost.costPerVote)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Wallet className="w-4 h-4" />
                        Maior gasto
                      </div>
                      <p className="font-semibold truncate">{comparisonStats.highestExpenses.name}</p>
                      <p className="text-lg font-bold text-warning">
                        {formatCurrency(comparisonStats.highestExpenses.totalExpenses)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Detailed Comparison Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Detalhamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Métrica</th>
                          {selectedCandidacies.map((c, i) => (
                            <th key={c.id} className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[i] }}
                                />
                                <span className="truncate max-w-[100px]">{c.name}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-medium">Partido</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right">
                              <Badge variant="outline">{c.party}</Badge>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Votos</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right font-mono">
                              {formatNumber(c.votes)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Total de Gastos</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right font-mono">
                              {formatCurrency(c.totalExpenses)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Despesas Financeiras</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right font-mono">
                              {formatCurrency(c.financialExpenses)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Doações Estimadas</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right font-mono">
                              {formatCurrency(c.estimatedDonations)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Custo por Voto</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right font-mono">
                              {formatCurrency(c.costPerVote)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">% Financeiro</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right font-mono">
                              {formatPercentage(c.financialExpensesPct)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Gênero</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right">{c.gender}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Raça/Cor</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right">{c.race}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="font-medium">Escolaridade</td>
                          {selectedCandidacies.map((c) => (
                            <td key={c.id} className="text-right text-xs">{c.education}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              {selectedCandidacies.length >= 2 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Comparativo de Votos e Gastos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={[
                            {
                              name: 'Votos',
                              ...selectedCandidacies.reduce((acc, c) => {
                                acc[c.name] = c.votes;
                                return acc;
                              }, {} as Record<string, number>),
                            },
                          ]}
                          layout="vertical"
                          margin={{ left: 10, right: 30 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                          <YAxis type="category" dataKey="name" hide />
                          <Tooltip
                            formatter={(value: number) => formatNumber(value)}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Legend />
                          {selectedCandidacies.map((c, i) => (
                            <Bar
                              key={c.id}
                              dataKey={c.name}
                              fill={CHART_COLORS[i]}
                              radius={[0, 4, 4, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Radar Chart */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Perfil Comparativo (Normalizado)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis
                            dataKey="metric"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          />
                          {selectedCandidacies.map((c, i) => (
                            <Radar
                              key={c.id}
                              name={c.name}
                              dataKey={c.name}
                              stroke={CHART_COLORS[i]}
                              fill={CHART_COLORS[i]}
                              fillOpacity={0.15}
                              strokeWidth={2}
                            />
                          ))}
                          <Legend />
                          <Tooltip
                            formatter={(value: number) => `${value.toFixed(1)}%`}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
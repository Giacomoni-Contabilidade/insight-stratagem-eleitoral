import React, { useState, useMemo } from 'react';
import { useCampaignStore } from '@/store/campaignStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LEGAL_EXPENSE_CATEGORIES, type LegalExpenseCategory, type Candidacy } from '@/types/campaign';
import { formatCurrency, formatNumber } from '@/lib/dataParser';
import { 
  TrendingDown, 
  TrendingUp, 
  Vote, 
  Wallet,
  Trophy,
  Medal,
  Award
} from 'lucide-react';

type RankingType = 
  | 'cheapest-votes' 
  | 'expensive-votes' 
  | 'most-voted' 
  | 'least-voted' 
  | 'most-expenses' 
  | 'least-expenses'
  | 'category-expenses';

interface RankingConfig {
  id: RankingType;
  title: string;
  icon: React.ReactNode;
  description: string;
  getValue: (c: Candidacy, category?: LegalExpenseCategory) => number;
  format: (value: number) => string;
  sortOrder: 'asc' | 'desc';
  color: string;
}

const RANKING_CONFIGS: RankingConfig[] = [
  {
    id: 'cheapest-votes',
    title: 'Votos Mais Baratos',
    icon: <TrendingDown className="w-5 h-5" />,
    description: 'Menor custo por voto',
    getValue: (c) => c.costPerVote,
    format: formatCurrency,
    sortOrder: 'asc',
    color: 'text-success',
  },
  {
    id: 'expensive-votes',
    title: 'Votos Mais Caros',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'Maior custo por voto',
    getValue: (c) => c.costPerVote,
    format: formatCurrency,
    sortOrder: 'desc',
    color: 'text-destructive',
  },
  {
    id: 'most-voted',
    title: 'Mais Votados',
    icon: <Trophy className="w-5 h-5" />,
    description: 'Maior número de votos',
    getValue: (c) => c.votes,
    format: (v) => formatNumber(v, 0),
    sortOrder: 'desc',
    color: 'text-primary',
  },
  {
    id: 'least-voted',
    title: 'Menos Votados',
    icon: <Vote className="w-5 h-5" />,
    description: 'Menor número de votos',
    getValue: (c) => c.votes,
    format: (v) => formatNumber(v, 0),
    sortOrder: 'asc',
    color: 'text-muted-foreground',
  },
  {
    id: 'most-expenses',
    title: 'Maiores Gastos',
    icon: <Wallet className="w-5 h-5" />,
    description: 'Maior gasto total',
    getValue: (c) => c.totalExpenses,
    format: formatCurrency,
    sortOrder: 'desc',
    color: 'text-accent',
  },
  {
    id: 'least-expenses',
    title: 'Menores Gastos',
    icon: <Award className="w-5 h-5" />,
    description: 'Menor gasto total',
    getValue: (c) => c.totalExpenses,
    format: formatCurrency,
    sortOrder: 'asc',
    color: 'text-success',
  },
];

const getMedalColor = (position: number): string => {
  switch (position) {
    case 1: return 'bg-yellow-500 text-yellow-950';
    case 2: return 'bg-gray-400 text-gray-900';
    case 3: return 'bg-amber-600 text-amber-950';
    default: return 'bg-muted text-muted-foreground';
  }
};

const RankingTable: React.FC<{
  candidates: Candidacy[];
  config: RankingConfig;
  selectedCategory?: LegalExpenseCategory;
}> = ({ candidates, config, selectedCategory }) => {
  const sortedCandidates = useMemo(() => {
    const getValue = (c: Candidacy) => {
      if (config.id === 'category-expenses' && selectedCategory) {
        return c.expenses[selectedCategory] || 0;
      }
      return config.getValue(c);
    };

    return [...candidates]
      .filter((c) => {
        // For cost per vote, exclude candidates with 0 votes
        if (config.id === 'cheapest-votes' || config.id === 'expensive-votes') {
          return c.votes > 0;
        }
        return true;
      })
      .sort((a, b) => {
        const aVal = getValue(a);
        const bVal = getValue(b);
        return config.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      })
      .slice(0, 10);
  }, [candidates, config, selectedCategory]);

  const formatValue = (c: Candidacy) => {
    if (config.id === 'category-expenses' && selectedCategory) {
      return formatCurrency(c.expenses[selectedCategory] || 0);
    }
    return config.format(config.getValue(c));
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Candidatura</TableHead>
          <TableHead>Partido</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedCandidates.map((candidate, index) => (
          <TableRow key={candidate.id}>
            <TableCell>
              <Badge className={getMedalColor(index + 1)}>
                {index + 1}
              </Badge>
            </TableCell>
            <TableCell className="font-medium max-w-[200px] truncate" title={candidate.name}>
              {candidate.name}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{candidate.party}</Badge>
            </TableCell>
            <TableCell className={`text-right font-mono font-semibold ${config.color}`}>
              {formatValue(candidate)}
            </TableCell>
          </TableRow>
        ))}
        {sortedCandidates.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              Nenhuma candidatura encontrada
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export const TopTenView: React.FC = () => {
  const activeDatasetId = useCampaignStore((s) => s.activeDatasetId);
  const datasets = useCampaignStore((s) => s.datasets);
  const activeDataset = datasets.find((d) => d.id === activeDatasetId);
  
  const [selectedCategory, setSelectedCategory] = useState<LegalExpenseCategory | ''>('');

  const candidates = activeDataset?.candidacies || [];

  const categoryConfig: RankingConfig = {
    id: 'category-expenses',
    title: selectedCategory ? `Top 10 - ${selectedCategory}` : 'Selecione uma Categoria',
    icon: <Medal className="w-5 h-5" />,
    description: 'Maiores gastos na categoria selecionada',
    getValue: (c, cat) => cat ? c.expenses[cat] || 0 : 0,
    format: formatCurrency,
    sortOrder: 'desc',
    color: 'text-primary',
  };

  if (!activeDataset) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Medal className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum dataset selecionado</h3>
          <p className="text-muted-foreground">
            Importe dados ou selecione um dataset para ver os rankings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7 text-primary" />
          Rankings 10+
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize os top 10 em diferentes métricas de desempenho e gastos
        </p>
      </div>

      {/* Main Rankings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {RANKING_CONFIGS.map((config) => (
          <Card key={config.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className={config.color}>{config.icon}</span>
                {config.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </CardHeader>
            <CardContent className="p-0">
              <RankingTable candidates={candidates} config={config} />
            </CardContent>
          </Card>
        ))}

        {/* Category-specific ranking */}
        <Card className="overflow-hidden lg:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-primary"><Medal className="w-5 h-5" /></span>
              Por Categoria de Despesa
            </CardTitle>
            <p className="text-sm text-muted-foreground mb-3">
              Selecione uma categoria para ver os maiores gastos
            </p>
            <Select 
              value={selectedCategory || 'none'} 
              onValueChange={(v) => setSelectedCategory(v === 'none' ? '' : v as LegalExpenseCategory)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">Selecione uma categoria...</SelectItem>
                {LEGAL_EXPENSE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            {selectedCategory ? (
              <RankingTable 
                candidates={candidates} 
                config={categoryConfig}
                selectedCategory={selectedCategory}
              />
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>Selecione uma categoria acima para ver o ranking</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

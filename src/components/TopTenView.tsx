import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LEGAL_EXPENSE_CATEGORIES, type LegalExpenseCategory, type Candidacy } from '@/types/campaign';
import { formatCurrency, formatNumber } from '@/lib/dataParser';
import { 
  TrendingDown, 
  TrendingUp, 
  Vote, 
  Wallet,
  Trophy,
  Medal,
  Award,
  
  Sparkles,
  CheckCircle2,
  XCircle,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ElectedFilter = 'all' | 'elected' | 'not-elected';

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
  shortTitle: string;
  icon: React.ReactNode;
  description: string;
  getValue: (c: Candidacy, category?: LegalExpenseCategory) => number;
  format: (value: number) => string;
  sortOrder: 'asc' | 'desc';
  gradient: string;
  iconBg: string;
  limit: number;
  electedOnly?: boolean;
  showElectedColumn?: boolean;
  splitByElected?: boolean;
}

const RANKING_CONFIGS: RankingConfig[] = [
  {
    id: 'most-voted',
    title: 'Top 20 Mais Votados',
    shortTitle: 'Votados',
    icon: <Trophy className="w-5 h-5" />,
    description: 'Maior número de votos',
    getValue: (c) => c.votes,
    format: (v) => formatNumber(v, 0),
    sortOrder: 'desc',
    gradient: 'from-amber-500 to-yellow-600',
    iconBg: 'bg-amber-500/10 text-amber-600',
    limit: 20,
  },
  {
    id: 'least-voted',
    title: 'Menos Votados (Eleitos)',
    shortTitle: 'Menos',
    icon: <Vote className="w-5 h-5" />,
    description: 'Menor número de votos entre eleitos',
    getValue: (c) => c.votes,
    format: (v) => formatNumber(v, 0),
    sortOrder: 'asc',
    gradient: 'from-slate-400 to-slate-500',
    iconBg: 'bg-slate-500/10 text-slate-500',
    limit: 10,
    electedOnly: true,
  },
  {
    id: 'most-expenses',
    title: 'Top 20 Maiores Gastos',
    shortTitle: 'Maiores',
    icon: <Wallet className="w-5 h-5" />,
    description: 'Maior gasto total',
    getValue: (c) => c.totalExpenses,
    format: formatCurrency,
    sortOrder: 'desc',
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-500/10 text-violet-600',
    limit: 20,
    showElectedColumn: true,
  },
  {
    id: 'least-expenses',
    title: 'Menores Gastos (Eleitos)',
    shortTitle: 'Menores',
    icon: <Award className="w-5 h-5" />,
    description: 'Menor gasto total entre eleitos',
    getValue: (c) => c.totalExpenses,
    format: formatCurrency,
    sortOrder: 'asc',
    gradient: 'from-cyan-500 to-blue-600',
    iconBg: 'bg-cyan-500/10 text-cyan-600',
    limit: 10,
    electedOnly: true,
  },
  {
    id: 'expensive-votes',
    title: 'Votos Mais Caros',
    shortTitle: 'Caros',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'Maior custo por voto',
    getValue: (c) => c.costPerVote,
    format: formatCurrency,
    sortOrder: 'desc',
    gradient: 'from-rose-500 to-red-600',
    iconBg: 'bg-rose-500/10 text-rose-600',
    limit: 10,
    splitByElected: true,
  },
  {
    id: 'cheapest-votes',
    title: 'Votos Mais Baratos (Eleitos)',
    shortTitle: 'Baratos',
    icon: <TrendingDown className="w-5 h-5" />,
    description: 'Menor custo por voto entre eleitos',
    getValue: (c) => c.costPerVote,
    format: formatCurrency,
    sortOrder: 'asc',
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-500/10 text-emerald-600',
    limit: 10,
    electedOnly: true,
  },
];

const PositionBadge: React.FC<{ position: number }> = ({ position }) => {
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
      <span className="text-sm font-medium text-muted-foreground">{position}</span>
    </div>
  );
};

const ElectedBadge: React.FC<{ elected: boolean }> = ({ elected }) => (
  <Badge variant={elected ? "default" : "secondary"} className={cn("text-xs px-1.5 py-0", elected ? "bg-emerald-600" : "")}>
    {elected ? "Eleito" : "Não"}
  </Badge>
);

const RankingCard: React.FC<{
  config: RankingConfig;
  candidates: Candidacy[];
  selectedCategory?: LegalExpenseCategory;
  electedFilter?: ElectedFilter;
}> = ({ config, candidates, selectedCategory, electedFilter = 'all' }) => {
  const sortedCandidates = useMemo(() => {
    const getValue = (c: Candidacy) => {
      if (config.id === 'category-expenses' && selectedCategory) {
        return c.expenses[selectedCategory] || 0;
      }
      return config.getValue(c);
    };

    let filtered = [...candidates];

    // Apply elected-only filter for specific rankings
    if (config.electedOnly) {
      filtered = filtered.filter(c => c.elected);
    }

    // Apply global elected filter
    if (electedFilter === 'elected') {
      filtered = filtered.filter(c => c.elected);
    } else if (electedFilter === 'not-elected') {
      filtered = filtered.filter(c => !c.elected);
    }

    return filtered
      .filter((c) => {
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
      .slice(0, config.limit);
  }, [candidates, config, selectedCategory, electedFilter]);

  const formatValue = (c: Candidacy) => {
    if (config.id === 'category-expenses' && selectedCategory) {
      return formatCurrency(c.expenses[selectedCategory] || 0);
    }
    return config.format(config.getValue(c));
  };

  const topCandidate = sortedCandidates[0];
  const showElected = config.showElectedColumn;

  return (
    <Card className="overflow-hidden shadow-card hover:shadow-lg transition-shadow duration-300">
      {/* Header with gradient */}
      <div className={cn("p-4 bg-gradient-to-r text-white", config.gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {config.icon}
            </div>
            <div>
              <h3 className="font-semibold text-base">{config.title}</h3>
              <p className="text-xs text-white/80">{config.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ranking list */}
      <CardContent className="p-0">
        <ScrollArea className={config.limit > 10 ? "h-[450px]" : "h-[280px]"}>
          <div className="p-3 space-y-1">
            {sortedCandidates.map((candidate, index) => (
              <div 
                key={candidate.id} 
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <PositionBadge position={index + 1} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors" title={candidate.name}>
                    {candidate.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{candidate.party}</p>
                </div>
                {showElected && <ElectedBadge elected={candidate.elected} />}
                <span className="font-mono text-sm font-semibold text-foreground/80 whitespace-nowrap ml-2">
                  {formatValue(candidate)}
                </span>
              </div>
            ))}
            {sortedCandidates.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                Nenhuma candidatura
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export const TopTenView: React.FC = () => {
  const { activeDatasetId, filteredDatasets: datasets, getFilteredCandidacies } = useData();
  const activeDataset = datasets.find((d) => d.id === activeDatasetId);
  
  const [selectedCategory, setSelectedCategory] = useState<LegalExpenseCategory | ''>('');
  const [electedFilter, setElectedFilter] = useState<ElectedFilter>('all');

  const candidates = getFilteredCandidacies();

  const categoryConfig: RankingConfig = {
    id: 'category-expenses',
    title: selectedCategory || 'Por Categoria',
    shortTitle: 'Categoria',
    icon: <Medal className="w-5 h-5" />,
    description: 'Maiores gastos na categoria',
    getValue: (c, cat) => cat ? c.expenses[cat] || 0 : 0,
    format: formatCurrency,
    sortOrder: 'desc',
    gradient: 'from-primary to-primary/80',
    iconBg: 'bg-primary/10 text-primary',
    limit: 10,
  };

  if (!activeDataset) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhum dataset selecionado</h3>
          <p className="text-muted-foreground">
            Importe dados ou selecione um dataset para visualizar os rankings das candidaturas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Rankings</h1>
              <p className="text-muted-foreground">
                {candidates.length} candidaturas no dataset
              </p>
            </div>
          </div>
        </div>
        
        {/* Global elected filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          <ToggleGroup type="single" value={electedFilter} onValueChange={(v) => v && setElectedFilter(v as ElectedFilter)}>
            <ToggleGroupItem value="all" className="text-xs px-3 gap-1">
              <Users className="w-3.5 h-3.5" />
              Geral
            </ToggleGroupItem>
            <ToggleGroupItem value="elected" className="text-xs px-3 gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Eleitos
            </ToggleGroupItem>
            <ToggleGroupItem value="not-elected" className="text-xs px-3 gap-1">
              <XCircle className="w-3.5 h-3.5" />
              Não Eleitos
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Tabs for organization */}
      <Tabs defaultValue="votes" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-12">
          <TabsTrigger value="votes" className="data-[state=active]:bg-card data-[state=active]:shadow-sm px-6">
            <Vote className="w-4 h-4 mr-2" />
            Votos
          </TabsTrigger>
          <TabsTrigger value="expenses" className="data-[state=active]:bg-card data-[state=active]:shadow-sm px-6">
            <Wallet className="w-4 h-4 mr-2" />
            Gastos
          </TabsTrigger>
          <TabsTrigger value="cost" className="data-[state=active]:bg-card data-[state=active]:shadow-sm px-6">
            <TrendingUp className="w-4 h-4 mr-2" />
            Custo/Voto
          </TabsTrigger>
          <TabsTrigger value="category" className="data-[state=active]:bg-card data-[state=active]:shadow-sm px-6">
            <Sparkles className="w-4 h-4 mr-2" />
            Por Categoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="votes" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RankingCard 
              config={RANKING_CONFIGS.find(c => c.id === 'most-voted')!} 
              candidates={candidates} 
              electedFilter={electedFilter}
            />
            <RankingCard 
              config={RANKING_CONFIGS.find(c => c.id === 'least-voted')!} 
              candidates={candidates} 
              electedFilter={electedFilter}
            />
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RankingCard 
              config={RANKING_CONFIGS.find(c => c.id === 'most-expenses')!} 
              candidates={candidates} 
              electedFilter={electedFilter}
            />
            <RankingCard 
              config={RANKING_CONFIGS.find(c => c.id === 'least-expenses')!} 
              candidates={candidates} 
              electedFilter={electedFilter}
            />
          </div>
        </TabsContent>

        <TabsContent value="cost" className="space-y-6 animate-fade-in">
          {/* Expensive votes: split by elected */}
          {RANKING_CONFIGS.find(c => c.id === 'expensive-votes')!.splitByElected ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RankingCard 
                config={{
                  ...RANKING_CONFIGS.find(c => c.id === 'expensive-votes')!,
                  title: 'Votos Mais Caros (Eleitos)',
                  description: 'Maior custo por voto entre eleitos',
                  electedOnly: true,
                }}
                candidates={candidates}
                electedFilter={electedFilter}
              />
              <RankingCard 
                config={{
                  ...RANKING_CONFIGS.find(c => c.id === 'expensive-votes')!,
                  title: 'Votos Mais Caros (Não Eleitos)',
                  description: 'Maior custo por voto entre não eleitos',
                  gradient: 'from-orange-500 to-red-600',
                  electedOnly: false,
                  splitByElected: false,
                }}
                candidates={candidates.filter(c => !c.elected)}
                electedFilter={electedFilter === 'elected' ? 'all' : electedFilter}
              />
            </div>
          ) : null}
          
          {/* Cheapest votes: elected only */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RankingCard 
              config={RANKING_CONFIGS.find(c => c.id === 'cheapest-votes')!} 
              candidates={candidates} 
              electedFilter={electedFilter}
            />
          </div>
        </TabsContent>

        <TabsContent value="category" className="space-y-6 animate-fade-in">
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", categoryConfig.iconBg)}>
                  <Medal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Ranking por Categoria de Despesa</h3>
                  <p className="text-sm text-muted-foreground">Selecione uma categoria para ver os maiores investidores</p>
                </div>
              </div>
              <div className="md:ml-auto">
                <Select 
                  value={selectedCategory || 'none'} 
                  onValueChange={(v) => setSelectedCategory(v === 'none' ? '' : v as LegalExpenseCategory)}
                >
                  <SelectTrigger className="w-full md:w-80">
                    <SelectValue placeholder="Selecione uma categoria..." />
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
              </div>
            </div>

            {selectedCategory ? (
              <RankingCard 
                config={{...categoryConfig, title: selectedCategory}}
                candidates={candidates} 
                selectedCategory={selectedCategory}
                electedFilter={electedFilter}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground">
                  Selecione uma categoria acima para visualizar o ranking
                </p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

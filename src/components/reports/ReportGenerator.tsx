import React, { useState, useMemo, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { useData } from '@/contexts/DataContext';
import { CampaignReport, ReportSections } from './CampaignReport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Download, 
  Loader2, 
  CheckCircle2,
  BarChart3,
  Trophy,
  GitCompareArrows,
  PieChart,
  Search,
  X,
  FileDown,
  Receipt,
  Medal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Candidacy } from '@/types/campaign';
import { toast } from 'sonner';

interface SectionConfig {
  id: keyof ReportSections;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    id: 'summary',
    label: 'Resumo Geral',
    description: 'Estatísticas gerais: total de candidaturas, votos, gastos e médias',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    id: 'rankings',
    label: 'Rankings 10+',
    description: 'Top 10 mais votados, votos mais baratos/caros, maiores/menores gastos',
    icon: <Trophy className="w-5 h-5" />,
  },
  {
    id: 'expenseTypes',
    label: 'Tipos de Despesas',
    description: 'Análise detalhada por categoria legal de despesa, com gráficos e percentuais',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    id: 'expenseChampions',
    label: 'Campeões por Categoria',
    description: 'Quem mais gastou em cada tipo de despesa, com comparativos',
    icon: <Medal className="w-5 h-5" />,
  },
  {
    id: 'comparison',
    label: 'Comparativo de Candidaturas',
    description: 'Tabela comparando candidaturas selecionadas lado a lado',
    icon: <GitCompareArrows className="w-5 h-5" />,
  },
  {
    id: 'distributions',
    label: 'Gráficos de Distribuição',
    description: 'Distribuição por partido, gênero, escolaridade e gastos',
    icon: <PieChart className="w-5 h-5" />,
  },
];

export const ReportGenerator: React.FC = () => {
  const { activeDatasetId, datasets } = useData();
  const activeDataset = datasets.find((d) => d.id === activeDatasetId);

  const [sections, setSections] = useState<ReportSections>({
    summary: true,
    rankings: true,
    comparison: false,
    distributions: true,
    expenseTypes: true,
    expenseChampions: true,
  });
  const [clientName, setClientName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidacies, setSelectedCandidacies] = useState<Candidacy[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset selected candidacies when dataset changes
  useEffect(() => {
    setSelectedCandidacies([]);
    setSearchQuery('');
  }, [activeDatasetId]);

  const filteredCandidacies = useMemo(() => {
    if (!activeDataset || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return activeDataset.candidacies.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.party.toLowerCase().includes(query)
    );
  }, [activeDataset, searchQuery]);

  const toggleSection = (sectionId: keyof ReportSections) => {
    setSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleCandidacy = (candidacy: Candidacy) => {
    setSelectedCandidacies((prev) => {
      const exists = prev.find((c) => c.id === candidacy.id);
      if (exists) {
        return prev.filter((c) => c.id !== candidacy.id);
      }
      if (prev.length >= 6) {
        toast.error('Máximo de 6 candidaturas para comparação');
        return prev;
      }
      return [...prev, candidacy];
    });
  };

  const removeCandidacy = (candidacyId: string) => {
    setSelectedCandidacies((prev) => prev.filter((c) => c.id !== candidacyId));
  };

  const handleGeneratePDF = async () => {
    if (!activeDataset) return;

    // Validate sections
    const hasAnySectionSelected = Object.values(sections).some(Boolean);
    if (!hasAnySectionSelected) {
      toast.error('Selecione pelo menos uma seção para o relatório');
      return;
    }

    if (sections.comparison && selectedCandidacies.length === 0) {
      toast.error('Selecione candidaturas para o comparativo ou desmarque a seção');
      return;
    }

    setIsGenerating(true);
    
    try {
      const blob = await pdf(
        <CampaignReport
          dataset={activeDataset}
          sections={sections}
          selectedCandidacies={selectedCandidacies}
          generatedAt={new Date()}
          clientName={clientName || undefined}
        />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `relatorio-${activeDataset.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!activeDataset) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhum dataset selecionado</h3>
          <p className="text-muted-foreground">
            Importe dados ou selecione um dataset para gerar relatórios.
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
              <FileDown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Gerador de Relatórios</h1>
              <p className="text-muted-foreground">
                Exporte análises em PDF profissional
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Section Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Name */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Informações do Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="clientName">Nome do Cliente (opcional)</Label>
                <Input
                  id="clientName"
                  placeholder="Ex: Assessoria Política XYZ"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Aparecerá na capa do relatório
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sections Selection */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Seções do Relatório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SECTION_CONFIGS.map((config) => (
                <div
                  key={config.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                    sections[config.id]
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => toggleSection(config.id)}
                >
                  <Checkbox
                    checked={sections[config.id]}
                    onCheckedChange={() => toggleSection(config.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    sections[config.id] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{config.label}</h4>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                  {sections[config.id] && (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Candidacy Selection for Comparison */}
          {sections.comparison && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitCompareArrows className="w-5 h-5" />
                  Selecionar Candidaturas para Comparação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selected Candidacies */}
                {selectedCandidacies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidacies.map((c) => (
                      <Badge
                        key={c.id}
                        variant="secondary"
                        className="pl-3 pr-1 py-1.5 flex items-center gap-2"
                      >
                        <span className="max-w-[150px] truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground">({c.party})</span>
                        <button
                          onClick={() => removeCandidacy(c.id)}
                          className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar candidatura por nome ou partido..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Search Results */}
                {searchQuery && filteredCandidacies.length > 0 && (
                  <ScrollArea className="h-48 rounded-lg border">
                    <div className="p-2 space-y-1">
                      {filteredCandidacies.slice(0, 20).map((c) => {
                        const isSelected = selectedCandidacies.some((sc) => sc.id === c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggleCandidacy(c)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                              isSelected ? "bg-primary/10" : "hover:bg-muted"
                            )}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.party}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}

                {searchQuery && filteredCandidacies.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma candidatura encontrada
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Selecione até 6 candidaturas para comparar no relatório
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Preview & Generate */}
        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Prévia do Relatório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dataset Info */}
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="font-medium">{activeDataset.name}</p>
                <p className="text-sm text-muted-foreground">
                  {activeDataset.position} • {activeDataset.state} • {activeDataset.year}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeDataset.candidacies.length} candidaturas
                </p>
              </div>

              <Separator />

              {/* Selected Sections Summary */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Seções incluídas:</p>
                <div className="space-y-1">
                  {SECTION_CONFIGS.filter((c) => sections[c.id]).map((config) => (
                    <div key={config.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span>{config.label}</span>
                    </div>
                  ))}
                  {!Object.values(sections).some(Boolean) && (
                    <p className="text-sm text-muted-foreground">Nenhuma seção selecionada</p>
                  )}
                </div>
              </div>

              {sections.comparison && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Candidaturas no comparativo:</p>
                    {selectedCandidacies.length > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {selectedCandidacies.length} candidatura(s) selecionada(s)
                      </p>
                    ) : (
                      <p className="text-sm text-destructive">
                        Selecione candidaturas acima
                      </p>
                    )}
                  </div>
                </>
              )}

              {clientName && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Cliente:</p>
                    <p className="text-sm text-muted-foreground">{clientName}</p>
                  </div>
                </>
              )}

              <Separator />

              {/* Generate Button */}
              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating || !Object.values(sections).some(Boolean)}
                className="w-full h-12"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Gerar Relatório PDF
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                O PDF será baixado automaticamente
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

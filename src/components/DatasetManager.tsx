import React from 'react';
import { useData } from '@/contexts/DataContext';
import { Dataset } from '@/types/campaign';
import { formatCurrency, formatNumber } from '@/lib/dataParser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Trash2, 
  Users, 
  Calendar,
  MapPin,
  Briefcase,
  ChevronRight,
  Package
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DatasetCardProps {
  dataset: Dataset;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  batchSize?: number;
}

const DatasetCard: React.FC<DatasetCardProps> = ({ dataset, isActive, onSelect, onDelete, batchSize }) => {
  const totalVotes = dataset.totalVotes;
  const totalExpenses = dataset.totalExpenses;
  
  return (
    <div 
      className={`glass-panel rounded-xl p-5 cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-primary shadow-glow' : 'hover:bg-muted/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isActive ? 'bg-primary/20' : 'bg-muted'
          }`}>
            <Database className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{dataset.name}</h3>
              {batchSize && batchSize > 1 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Package className="w-3 h-3 mr-1" />
                  {batchSize}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Criado em {new Date(dataset.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir dataset?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os dados de "{dataset.name}" serão permanentemente removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{dataset.year}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{dataset.state}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Briefcase className="w-4 h-4" />
          <span>{dataset.position}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{dataset.candidacyCount} candidaturas</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Total de votos</p>
          <p className="font-mono font-medium">{formatNumber(totalVotes)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total de gastos</p>
          <p className="font-mono font-medium">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>
      
      {isActive && (
        <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border text-primary text-sm">
          <span>Dataset ativo</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

export const DatasetManager: React.FC = () => {
  const { datasets, activeDatasetId, setActiveDatasetId, deleteDataset } = useData();
  
  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Database className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhum dataset cadastrado</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Importe seus primeiros dados para começar a análise.
        </p>
      </div>
    );
  }

  // Count batch sizes
  const batchCounts = new Map<string, number>();
  for (const ds of datasets) {
    if (ds.importBatchId) {
      batchCounts.set(ds.importBatchId, (batchCounts.get(ds.importBatchId) || 0) + 1);
    }
  }

  // Group datasets: batched ones together, individual ones standalone
  const batches = new Map<string, Dataset[]>();
  const individual: Dataset[] = [];

  for (const ds of datasets) {
    if (ds.importBatchId && batchCounts.get(ds.importBatchId)! > 1) {
      if (!batches.has(ds.importBatchId)) {
        batches.set(ds.importBatchId, []);
      }
      batches.get(ds.importBatchId)!.push(ds);
    } else {
      individual.push(ds);
    }
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Datasets</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie seus conjuntos de dados eleitorais
        </p>
      </div>

      {/* Batched datasets */}
      {Array.from(batches.entries()).map(([batchId, batchDatasets]) => (
        <div key={batchId} className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="w-4 h-4" />
            <span>Lote de importação — {batchDatasets.length} datasets</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchDatasets.map((dataset) => (
              <DatasetCard
                key={dataset.id}
                dataset={dataset}
                isActive={dataset.id === activeDatasetId}
                onSelect={() => setActiveDatasetId(dataset.id)}
                onDelete={() => deleteDataset(dataset.id)}
                batchSize={batchDatasets.length}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Individual datasets */}
      {individual.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {individual.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              isActive={dataset.id === activeDatasetId}
              onSelect={() => setActiveDatasetId(dataset.id)}
              onDelete={() => deleteDataset(dataset.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

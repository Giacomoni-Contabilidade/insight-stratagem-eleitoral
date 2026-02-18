import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { LEGAL_EXPENSE_CATEGORIES, AnalyticalGroup } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Layers,
  Tag,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#14b8a6', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#ef4444', '#22c55e', '#06b6d4', '#f97316', '#6366f1'
];

interface GroupFormData {
  name: string;
  categories: string[];
  color: string;
}

const GroupForm: React.FC<{
  initialData?: AnalyticalGroup;
  onSubmit: (data: GroupFormData) => void;
  onCancel: () => void;
  usedCategories: Map<string, string>; // category -> group name
}> = ({ initialData, onSubmit, onCancel, usedCategories }) => {
  const [formData, setFormData] = useState<GroupFormData>({
    name: initialData?.name || '',
    categories: initialData?.categories || [],
    color: initialData?.color || PRESET_COLORS[0],
  });
  
  const toggleCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }
    if (formData.categories.length === 0) {
      toast.error('Selecione ao menos uma categoria');
      return;
    }
    onSubmit(formData);
  };

  // Check if category is used by another group (not the one being edited)
  const isCategoryUsedElsewhere = (cat: string) => {
    const usedBy = usedCategories.get(cat);
    return usedBy && usedBy !== initialData?.name;
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nome do grupo</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Marketing Digital"
            className="mt-1.5"
          />
        </div>
        
        <div>
          <Label>Cor</Label>
          <div className="flex gap-2 mt-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData({ ...formData, color })}
                className={`w-8 h-8 rounded-full transition-all ${
                  formData.color === color ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : ''
                }`}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
        
        <div>
          <Label>Categorias legais incluídas</Label>
          <p className="text-xs text-muted-foreground mb-2">
            {formData.categories.length} selecionadas
          </p>
          <div className="max-h-64 overflow-y-auto scrollbar-thin border border-border rounded-lg p-3 space-y-2">
            {LEGAL_EXPENSE_CATEGORIES.map((cat) => {
              const usedBy = usedCategories.get(cat);
              const isUsedElsewhere = isCategoryUsedElsewhere(cat);
              const isSelected = formData.categories.includes(cat);
              
              return (
                <label
                  key={cat}
                  className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
                    isUsedElsewhere 
                      ? 'opacity-50 cursor-not-allowed bg-muted/20' 
                      : 'cursor-pointer hover:bg-muted/30'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !isUsedElsewhere && toggleCategory(cat)}
                    disabled={isUsedElsewhere || false}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm">{cat}</span>
                    {isUsedElsewhere && usedBy && (
                      <p className="text-xs text-muted-foreground">
                        Já está em: {usedBy}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {initialData ? 'Salvar alterações' : 'Criar grupo'}
        </Button>
      </DialogFooter>
    </form>
  );
};

export const AnalyticalGroups: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AnalyticalGroup | null>(null);
  
  const { analyticalGroups, addAnalyticalGroup, updateAnalyticalGroup, deleteAnalyticalGroup } = useData();
  
  // Build a map of category -> group name for exclusivity check
  const usedCategories = new Map<string, string>();
  analyticalGroups.forEach(group => {
    group.categories.forEach(cat => {
      usedCategories.set(cat, group.name);
    });
  });
  
  // Find orphan categories (not in any group)
  const orphanCategories = LEGAL_EXPENSE_CATEGORIES.filter(
    cat => !usedCategories.has(cat)
  );
  
  // Find duplicate categories (in multiple groups) - for validation display
  const categoryGroupCount = new Map<string, string[]>();
  analyticalGroups.forEach(group => {
    group.categories.forEach(cat => {
      const existing = categoryGroupCount.get(cat) || [];
      categoryGroupCount.set(cat, [...existing, group.name]);
    });
  });
  const duplicateCategories = Array.from(categoryGroupCount.entries())
    .filter(([_, groups]) => groups.length > 1)
    .map(([cat, groups]) => ({ category: cat, groups }));
  
  const handleSubmit = async (data: GroupFormData) => {
    if (editingGroup) {
      await updateAnalyticalGroup(editingGroup.id, {
        name: data.name,
        categories: data.categories as any[],
        color: data.color,
      });
      toast.success('Grupo atualizado com sucesso');
    } else {
      const result = await addAnalyticalGroup({
        name: data.name,
        categories: data.categories as any[],
        color: data.color,
      });
      if (result) {
        toast.success('Grupo criado com sucesso');
      }
    }
    setIsDialogOpen(false);
    setEditingGroup(null);
  };
  
  const handleEdit = (group: AnalyticalGroup) => {
    setEditingGroup(group);
    setIsDialogOpen(true);
  };

  const [deleteTarget, setDeleteTarget] = useState<AnalyticalGroup | null>(null);

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteAnalyticalGroup(deleteTarget.id);
      setDeleteTarget(null);
    }
  };
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grupos Analíticos</h1>
          <p className="text-muted-foreground text-sm">
            Agrupe categorias legais para análise gerencial personalizada
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingGroup(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? 'Editar grupo' : 'Novo grupo analítico'}
              </DialogTitle>
            </DialogHeader>
            <GroupForm
              initialData={editingGroup || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingGroup(null);
              }}
              usedCategories={usedCategories}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Warnings for orphan or duplicate categories */}
      {(orphanCategories.length > 0 || duplicateCategories.length > 0) && (
        <div className="space-y-3">
          {orphanCategories.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {orphanCategories.length} categorias sem grupo
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Essas categorias não serão contabilizadas na soma dos grupos analíticos:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {orphanCategories.map(cat => (
                  <span key={cat} className="chip bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                    {cat.substring(0, 30)}{cat.length > 30 ? '...' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {duplicateCategories.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-medium text-red-600 dark:text-red-400">
                  {duplicateCategories.length} categorias duplicadas
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Essas categorias estão em mais de um grupo (serão contadas em dobro):
              </p>
              <div className="space-y-1">
                {duplicateCategories.map(({ category, groups }) => (
                  <div key={category} className="text-xs">
                    <span className="font-medium">{category}</span>
                    <span className="text-muted-foreground"> → {groups.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status badge */}
      {orphanCategories.length === 0 && duplicateCategories.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-600 dark:text-green-400">
            Todas as {LEGAL_EXPENSE_CATEGORIES.length} categorias estão atribuídas a exatamente um grupo.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analyticalGroups.map((group) => (
          <div
            key={group.id}
            className="glass-panel rounded-xl p-5 relative overflow-hidden"
          >
            <div 
              className="absolute top-0 left-0 w-1 h-full" 
              style={{ background: group.color }}
            />
            
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">{group.name}</h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(group)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(group)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {group.categories.length} categorias incluídas
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                {group.categories.slice(0, 5).map((cat) => (
                  <span key={cat} className="chip bg-muted text-muted-foreground text-xs">
                    <Tag className="w-3 h-3" />
                    {cat.substring(0, 25)}{cat.length > 25 ? '...' : ''}
                  </span>
                ))}
                {group.categories.length > 5 && (
                  <span className="chip bg-muted text-muted-foreground text-xs">
                    +{group.categories.length - 5} mais
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Reference - All Legal Categories */}
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-4">
          Categorias legais de despesa ({LEGAL_EXPENSE_CATEGORIES.length} categorias)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
          {LEGAL_EXPENSE_CATEGORIES.map((cat) => {
            const usedIn = analyticalGroups.filter((g) => g.categories.includes(cat));
            return (
              <div key={cat} className="text-sm py-1.5 px-2 rounded hover:bg-muted/30">
                <p className="truncate">{cat}</p>
                {usedIn.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Em: {usedIn.map((g) => g.name).join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o grupo "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

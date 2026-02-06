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
  Plus, 
  Trash2, 
  Edit2, 
  Layers,
  Tag
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
}> = ({ initialData, onSubmit, onCancel }) => {
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
            {LEGAL_EXPENSE_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex items-start gap-3 cursor-pointer hover:bg-muted/30 p-2 rounded-md transition-colors"
              >
                <Checkbox
                  checked={formData.categories.includes(cat)}
                  onCheckedChange={() => toggleCategory(cat)}
                  className="mt-0.5"
                />
                <span className="text-sm">{cat}</span>
              </label>
            ))}
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
  
  const { analyticalGroups, updateAnalyticalGroup } = useData();
  
  // Note: For now, we only support editing existing groups
  // Adding/deleting groups would require additional backend methods
  
  const handleSubmit = async (data: GroupFormData) => {
    if (editingGroup) {
      await updateAnalyticalGroup(editingGroup.id, {
        name: data.name,
        categories: data.categories as any[],
        color: data.color,
      });
      toast.success('Grupo atualizado com sucesso');
    }
    setIsDialogOpen(false);
    setEditingGroup(null);
  };
  
  const handleEdit = (group: AnalyticalGroup) => {
    setEditingGroup(group);
    setIsDialogOpen(true);
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
            />
          </DialogContent>
        </Dialog>
      </div>
      
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
    </div>
  );
};

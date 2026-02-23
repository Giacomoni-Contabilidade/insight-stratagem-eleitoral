import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { Candidacy, LEGAL_EXPENSE_CATEGORIES } from '@/types/campaign';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  Download,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Column definitions ---

interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean';
  /** Function to extract value from a Candidacy */
  getValue: (c: Candidacy) => string | number | boolean;
  width?: string;
}

const BASE_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Candidatura', type: 'text', getValue: (c) => c.name },
  { key: 'party', label: 'Partido', type: 'text', getValue: (c) => c.party },
  { key: 'gender', label: 'Gênero', type: 'text', getValue: (c) => c.gender },
  { key: 'race', label: 'Raça/Cor', type: 'text', getValue: (c) => c.race },
  { key: 'education', label: 'Ensino', type: 'text', getValue: (c) => c.education },
  { key: 'occupation', label: 'Ocupação', type: 'text', getValue: (c) => c.occupation },
  { key: 'votes', label: 'Votos', type: 'number', getValue: (c) => c.votes },
  { key: 'financialExpenses', label: 'Despesas Financeiras', type: 'number', getValue: (c) => c.financialExpenses },
  { key: 'estimatedDonations', label: 'Doações Estimadas', type: 'number', getValue: (c) => c.estimatedDonations },
  { key: 'totalExpenses', label: 'Total de Gastos', type: 'number', getValue: (c) => c.totalExpenses },
  { key: 'costPerVote', label: 'Custo por Voto', type: 'number', getValue: (c) => c.costPerVote },
  { key: 'financialExpensesPct', label: '% Desp. Financeiras', type: 'number', getValue: (c) => c.financialExpensesPct },
  { key: 'estimatedDonationsPct', label: '% Doações Estimadas', type: 'number', getValue: (c) => c.estimatedDonationsPct },
  { key: 'elected', label: 'Eleito', type: 'boolean', getValue: (c) => c.elected },
];

const EXPENSE_COLUMNS: ColumnDef[] = LEGAL_EXPENSE_CATEGORIES.map((cat) => ({
  key: `expense_${cat}`,
  label: cat,
  type: 'number' as const,
  getValue: (c: Candidacy) => c.expenses[cat] ?? 0,
}));

const ALL_COLUMNS: ColumnDef[] = [...BASE_COLUMNS, ...EXPENSE_COLUMNS];

// Default visible: basic info columns only (not all 38 expense categories)
const DEFAULT_VISIBLE = new Set(BASE_COLUMNS.map((c) => c.key));

// --- Formatting helpers ---

const formatNumber = (val: number): string => {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCell = (col: ColumnDef, value: string | number | boolean): string => {
  if (col.type === 'boolean') return value ? 'Sim' : 'Não';
  if (col.type === 'number') return formatNumber(value as number);
  return String(value);
};

// --- Component ---

export const DataSpreadsheet: React.FC = () => {
  const { getFilteredCandidacies, getActiveDataset } = useData();
  const activeDataset = getActiveDataset();
  const candidacies = getFilteredCandidacies();

  // State
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [globalSearch, setGlobalSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');

  // Columns to display
  const displayColumns = useMemo(
    () => ALL_COLUMNS.filter((col) => visibleColumns.has(col.key)),
    [visibleColumns]
  );

  // Filter + sort data
  const processedData = useMemo(() => {
    let data = [...candidacies];

    // Global search
    if (globalSearch.trim()) {
      const search = globalSearch.toLowerCase();
      data = data.filter((c) =>
        displayColumns.some((col) => {
          const val = col.getValue(c);
          return String(val).toLowerCase().includes(search);
        })
      );
    }

    // Column filters
    for (const col of displayColumns) {
      const filterVal = columnFilters[col.key];
      if (!filterVal?.trim()) continue;

      if (col.type === 'text') {
        const search = filterVal.toLowerCase();
        data = data.filter((c) =>
          String(col.getValue(c)).toLowerCase().includes(search)
        );
      } else if (col.type === 'number') {
        // Support: ">100", "<50", ">=10", "<=20", "=5", or just a number for exact match
        const match = filterVal.match(/^([><=!]+)?\s*(.+)$/);
        if (match) {
          const operator = match[1] || '=';
          const numStr = match[2].replace(/\./g, '').replace(',', '.');
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            data = data.filter((c) => {
              const val = col.getValue(c) as number;
              switch (operator) {
                case '>': return val > num;
                case '>=': return val >= num;
                case '<': return val < num;
                case '<=': return val <= num;
                case '!=': return val !== num;
                default: return val === num;
              }
            });
          }
        }
      } else if (col.type === 'boolean') {
        const boolSearch = filterVal.toLowerCase();
        if (boolSearch === 'sim' || boolSearch === 's') {
          data = data.filter((c) => col.getValue(c) === true);
        } else if (boolSearch === 'não' || boolSearch === 'nao' || boolSearch === 'n') {
          data = data.filter((c) => col.getValue(c) === false);
        }
      }
    }

    // Sort
    if (sortColumn) {
      const col = ALL_COLUMNS.find((c) => c.key === sortColumn);
      if (col) {
        data.sort((a, b) => {
          const va = col.getValue(a);
          const vb = col.getValue(b);
          let cmp: number;
          if (col.type === 'number') {
            cmp = (va as number) - (vb as number);
          } else if (col.type === 'boolean') {
            cmp = (va === vb ? 0 : va ? -1 : 1);
          } else {
            cmp = String(va).localeCompare(String(vb), 'pt-BR');
          }
          return sortDirection === 'asc' ? cmp : -cmp;
        });
      }
    }

    return data;
  }, [candidacies, globalSearch, columnFilters, sortColumn, sortDirection, displayColumns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pagedData = processedData.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Reset page when filters change
  const updateFilter = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  // Sort handler
  const handleSort = useCallback((key: string) => {
    if (sortColumn === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
    setPage(0);
  }, [sortColumn]);

  // Column visibility toggle
  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAllColumns = useCallback(() => {
    setVisibleColumns(new Set(ALL_COLUMNS.map((c) => c.key)));
  }, []);

  const selectBaseColumns = useCallback(() => {
    setVisibleColumns(new Set(DEFAULT_VISIBLE));
  }, []);

  const clearAllColumns = useCallback(() => {
    // Keep at least name visible
    setVisibleColumns(new Set(['name']));
  }, []);

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = displayColumns.map((c) => c.label);
    const rows = processedData.map((candidacy) =>
      displayColumns.map((col) => {
        const val = col.getValue(candidacy);
        if (col.type === 'boolean') return val ? 'Sim' : 'Não';
        if (col.type === 'number') return String(val).replace('.', ',');
        // Escape quotes in text
        const str = String(val);
        return str.includes(';') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      })
    );

    const csvContent = [
      headers.join(';'),
      ...rows.map((r) => r.join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDataset?.name || 'dados'}_planilha.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [displayColumns, processedData, activeDataset]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setColumnFilters({});
    setGlobalSearch('');
    setPage(0);
  }, []);

  const hasActiveFilters = globalSearch.trim() !== '' || Object.values(columnFilters).some((v) => v.trim() !== '');

  if (!activeDataset) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg font-medium">Nenhum dataset selecionado</p>
        <p className="text-sm mt-1">Selecione um dataset no menu superior para visualizar os dados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Planilha de Dados</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {processedData.length === candidacies.length
              ? `${candidacies.length} candidaturas`
              : `${processedData.length} de ${candidacies.length} candidaturas`}
            {' · '}{displayColumns.length} de {ALL_COLUMNS.length} colunas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export */}
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border p-4">
        {/* Global search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em todas as colunas..."
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>

        {/* Toggle column filters */}
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtros por coluna
        </Button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-destructive">
            <X className="w-4 h-4" />
            Limpar filtros
          </Button>
        )}

        {/* Column selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Columns3 className="w-4 h-4" />
              Colunas ({displayColumns.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-[400px] flex flex-col p-0" align="end">
            {/* Sticky header: search + action buttons */}
            <div className="sticky top-0 z-10 bg-popover border-b border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Colunas visíveis</h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAllColumns} className="text-xs h-7 px-2">
                    Todas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={selectBaseColumns} className="text-xs h-7 px-2">
                    Básicas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllColumns} className="text-xs h-7 px-2">
                    Mínimo
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar coluna..."
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
                {columnSearch && (
                  <button
                    onClick={() => setColumnSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto p-3 space-y-3">
              {(() => {
                const search = columnSearch.toLowerCase();
                const filteredBase = BASE_COLUMNS.filter((c) =>
                  !search || c.label.toLowerCase().includes(search)
                );
                const filteredExpense = EXPENSE_COLUMNS.filter((c) =>
                  !search || c.label.toLowerCase().includes(search)
                );

                if (filteredBase.length === 0 && filteredExpense.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma coluna encontrada.
                    </p>
                  );
                }

                return (
                  <>
                    {filteredBase.length > 0 && (
                      <div className="border-b border-border pb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Dados básicos
                        </p>
                        {filteredBase.map((col) => (
                          <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                            <Checkbox
                              checked={visibleColumns.has(col.key)}
                              onCheckedChange={() => toggleColumn(col.key)}
                            />
                            <span className="text-sm">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {filteredExpense.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Categorias de despesa ({filteredExpense.length})
                        </p>
                        {filteredExpense.map((col) => (
                          <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                            <Checkbox
                              checked={visibleColumns.has(col.key)}
                              onCheckedChange={() => toggleColumn(col.key)}
                            />
                            <span className="text-sm truncate">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </PopoverContent>
        </Popover>

        {/* Page size */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Linhas:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {/* Column headers */}
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center font-semibold sticky left-0 bg-muted/50 z-10">
                  #
                </TableHead>
                {displayColumns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none whitespace-nowrap hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-xs">{col.label}</span>
                      {sortColumn === col.key ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>

              {/* Column filters row */}
              {showFilters && (
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 bg-muted/30 z-10" />
                  {displayColumns.map((col) => (
                    <TableHead key={col.key} className="p-1">
                      <Input
                        placeholder={
                          col.type === 'number'
                            ? '>100, <50...'
                            : col.type === 'boolean'
                            ? 'Sim/Não'
                            : 'Filtrar...'
                        }
                        value={columnFilters[col.key] || ''}
                        onChange={(e) => updateFilter(col.key, e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                  ))}
                </TableRow>
              )}
            </TableHeader>

            <TableBody>
              {pagedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={displayColumns.length + 1}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Nenhum resultado encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                pagedData.map((candidacy, idx) => (
                  <TableRow
                    key={candidacy.id}
                    className={cn(
                      'hover:bg-muted/30 transition-colors',
                      candidacy.elected && 'bg-success/5'
                    )}
                  >
                    <TableCell className="text-center text-xs text-muted-foreground font-mono sticky left-0 bg-card z-10">
                      {safePage * pageSize + idx + 1}
                    </TableCell>
                    {displayColumns.map((col) => {
                      const value = col.getValue(candidacy);
                      return (
                        <TableCell
                          key={col.key}
                          className={cn(
                            'whitespace-nowrap text-sm',
                            col.type === 'number' && 'text-right font-mono tabular-nums',
                            col.type === 'boolean' && 'text-center'
                          )}
                        >
                          {col.type === 'boolean' ? (
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                              value ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                            )}>
                              {value ? 'Sim' : 'Não'}
                            </span>
                          ) : (
                            formatCell(col, value)
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {processedData.length === 0 ? 0 : safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, processedData.length)} de {processedData.length}
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage === 0}
            onClick={() => setPage(0)}
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="px-3 text-sm text-muted-foreground">
            Página {safePage + 1} de {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

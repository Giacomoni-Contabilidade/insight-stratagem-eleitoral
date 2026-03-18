import React, { useState, useCallback, useRef, useEffect } from 'react';
import { parseSpreadsheetData, validateParsedData } from '@/lib/dataParser';
import { useData } from '@/contexts/DataContext';
import { Candidacy, ParsedRow, COLUMN_ORDER, type LegalExpenseCategory } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ClipboardPaste, 
  AlertTriangle, 
  CheckCircle2, 
  Upload,
  X,
  FileSpreadsheet,
  Loader2,
  FileUp
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Clock } from 'lucide-react';

// ── Token Timer Component ──
const TokenTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const updateTimer = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTimeLeft(null);
        return;
      }
      const expiresAt = session.expires_at; // unix seconds
      if (!expiresAt) { setTimeLeft(null); return; }
      const now = Math.floor(Date.now() / 1000);
      const diff = expiresAt - now;
      if (diff <= 0) { setTimeLeft('Expirado'); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) return null;

  const isLow = timeLeft === 'Expirado' || (timeLeft && parseInt(timeLeft) === 0 && timeLeft.startsWith('00:0'));

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono ${
      isLow ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
    }`}>
      <Clock className="w-3 h-3" />
      <span>Token: {timeLeft}</span>
    </div>
  );
};

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 
  'SP', 'SE', 'TO'
];

const POSITIONS = [
  'Prefeito', 'Vice-Prefeito', 'Vereador',
  'Governador', 'Vice-Governador', 'Deputado Estadual',
  'Senador', 'Deputado Federal',
  'Presidente', 'Vice-Presidente'
];

interface DatasetFormData {
  name: string;
  year: string;
  state: string;
  position: string;
}

// ── File Upload Sub-component ──

const FileUploadTab: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const { refetch } = useData();
  const [file, setFile] = useState<File | null>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [formData, setFormData] = useState<DatasetFormData>({
    name: '',
    year: new Date().getFullYear().toString(),
    state: '',
    position: '',
  });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ totalDatasets?: number; totalImported?: number; imported?: number; errors?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      toast.error('Preencha o nome do dataset');
      return;
    }

    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 4;
    const year = parseInt(formData.year);
    if (isNaN(year) || year < 2000 || year > maxYear) {
      toast.error(`Ano deve estar entre 2000 e ${maxYear}`);
      return;
    }

    if (!multiMode) {
      const trimmedState = formData.state.trim();
      const trimmedPosition = formData.position.trim();
      if (!trimmedState || !trimmedPosition) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    }

    setUploading(true);
    setProgress(10);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const body = new FormData();
      body.append('file', file);
      body.append('name', trimmedName);
      body.append('year', formData.year);
      body.append('mode', multiMode ? 'multi' : 'single');

      if (!multiMode) {
        body.append('state', formData.state.trim());
        body.append('position', formData.position.trim());
      }

      setProgress(30);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/import-csv`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body,
        }
      );

      setProgress(80);

      const resultData = await res.json();

      if (!res.ok) {
        toast.error(resultData.error || 'Erro ao importar arquivo');
        return;
      }

      setProgress(100);
      setResult(resultData);

      if (multiMode) {
        toast.success(
          `${resultData.totalDatasets} datasets criados com ${resultData.totalImported} candidaturas!${resultData.errors > 0 ? ` (${resultData.errors} linhas com erro)` : ''}`
        );
      } else {
        toast.success(
          `${resultData.imported} candidaturas importadas com sucesso!${resultData.errors > 0 ? ` (${resultData.errors} linhas com erro ignoradas)` : ''}`
        );
      }

      // Refresh datasets from backend then reset
      await refetch();
      setFile(null);
      setFormData({ name: '', year: new Date().getFullYear().toString(), state: '', position: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess?.();
    } catch (error) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Upload de arquivo CSV</h2>
              <p className="text-sm text-muted-foreground">
                Envie um arquivo CSV diretamente — processado no servidor
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Modo multi-dataset</p>
                <p className="text-xs text-muted-foreground">
                  CSV com colunas Cargo e UF — cria datasets separados automaticamente
                </p>
              </div>
            </div>
            <Switch checked={multiMode} onCheckedChange={setMultiMode} />
          </div>

          <label
            htmlFor="csv-upload"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <FileUp className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Clique para selecionar ou arraste um arquivo<br />
              <span className="text-xs">.csv, .tsv ou .txt (separado por tab, vírgula ou ponto-e-vírgula)</span>
            </p>
            <input
              id="csv-upload"
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  {multiMode ? 'Formato multi-dataset' : 'Formato padrão'}
                </p>
                <p className="text-xs">
                  {multiMode
                    ? 'O CSV deve conter as colunas: Candidatura, Cargo, Partido, UF, Municipio, Genero, Raça_cor, Ensino, Ocupacao, Votos, Despesas_Financeiras, Doacoes_Estimadas, Total de gastos, e as 38 categorias de despesa. Os datasets serão agrupados por Cargo + UF.'
                    : `O arquivo deve seguir a mesma ordem de ${COLUMN_ORDER.length} colunas do formato padrão.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Configurar {multiMode ? 'importação multi-dataset' : 'dataset'}</h2>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="w-4 h-4 mr-2" />
              Trocar arquivo
            </Button>
          </div>

          <div className="glass-panel rounded-lg p-4 flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">{file.name}</p>
              <p className="text-muted-foreground text-xs">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
                {multiMode && ' • Modo multi-dataset (agrupado por Cargo + UF)'}
              </p>
            </div>
          </div>

          {multiMode ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Prefixo do nome dos datasets</Label>
                <Input
                  id="name"
                  placeholder="Ex: Eleições 2024"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cada dataset será nomeado: "Prefixo - Cargo - UF"
                </p>
              </div>
              <div>
                <Label htmlFor="year">Ano</Label>
                <Input
                  id="year"
                  type="number"
                  min="2000"
                  max={new Date().getFullYear() + 4}
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
          ) : (
            <DatasetConfigForm formData={formData} setFormData={setFormData} />
          )}

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress < 30 ? 'Preparando upload...' : progress < 80 ? 'Enviando e processando...' : 'Finalizando...'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                !formData.name ||
                (!multiMode && (!formData.state || !formData.position)) ||
                uploading
              }
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {uploading ? 'Importando...' : multiMode ? 'Importar multi-dataset' : 'Importar dataset'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Shared dataset config form ──

const DatasetConfigForm: React.FC<{
  formData: DatasetFormData;
  setFormData: React.Dispatch<React.SetStateAction<DatasetFormData>>;
}> = ({ formData, setFormData }) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="col-span-2">
      <Label htmlFor="name">Nome do dataset</Label>
      <Input
        id="name"
        placeholder="Ex: Eleições Municipais 2024 - São Paulo"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="mt-1.5"
      />
    </div>
    <div>
      <Label htmlFor="year">Ano</Label>
      <Input
        id="year"
        type="number"
        min="2000"
        max={new Date().getFullYear() + 4}
        value={formData.year}
        onChange={(e) => setFormData({ ...formData, year: e.target.value })}
        className="mt-1.5"
      />
    </div>
    <div>
      <Label>Estado (UF)</Label>
      <Select value={formData.state} onValueChange={(v) => setFormData({ ...formData, state: v })}>
        <SelectTrigger className="mt-1.5">
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {BRAZILIAN_STATES.map((uf) => (
            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="col-span-2">
      <Label>Cargo</Label>
      <Select value={formData.position} onValueChange={(v) => setFormData({ ...formData, position: v })}>
        <SelectTrigger className="mt-1.5">
          <SelectValue placeholder="Selecione o cargo" />
        </SelectTrigger>
        <SelectContent>
          {POSITIONS.map((pos) => (
            <SelectItem key={pos} value={pos}>{pos}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);

// ── Paste Tab Sub-component ──

const PasteTab: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [pastedData, setPastedData] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [formData, setFormData] = useState<DatasetFormData>({
    name: '',
    year: new Date().getFullYear().toString(),
    state: '',
    position: '',
  });
  const [step, setStep] = useState<'paste' | 'validate' | 'configure'>('paste');
  const [importing, setImporting] = useState(false);
  
  const { addDataset } = useData();
  
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    setPastedData(text);
    const rows = parseSpreadsheetData(text);
    setParsedRows(rows);
    if (rows.length > 0) setStep('validate');
  }, []);
  
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedData(text);
    if (text.includes('\t')) {
      const rows = parseSpreadsheetData(text);
      setParsedRows(rows);
      if (rows.length > 0) setStep('validate');
    }
  }, []);
  
  const { valid, invalid } = validateParsedData(parsedRows);
  
  const handleProceed = () => {
    if (valid.length === 0) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }
    setStep('configure');
  };
  
  const handleImport = async () => {
    const trimmedName = formData.name.trim();
    const trimmedState = formData.state.trim();
    const trimmedPosition = formData.position.trim();

    if (!trimmedName || !trimmedState || !trimmedPosition) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 4;
    const year = parseInt(formData.year);
    if (isNaN(year) || year < 2000 || year > maxYear) {
      toast.error(`Ano deve estar entre 2000 e ${maxYear}`);
      return;
    }
    
    setImporting(true);
    
    try {
      const candidacies: Candidacy[] = valid.map((row) => ({
        id: row.data.id ?? '',
        datasetId: '',
        name: row.data.name ?? '',
        party: row.data.party ?? '',
        gender: row.data.gender ?? 'Não informado',
        race: row.data.race ?? 'Não informado',
        education: row.data.education ?? 'Não informado',
        occupation: row.data.occupation ?? 'Não informado',
        votes: row.data.votes ?? 0,
        financialExpenses: row.data.financialExpenses ?? 0,
        estimatedDonations: row.data.estimatedDonations ?? 0,
        totalExpenses: row.data.totalExpenses ?? 0,
        costPerVote: row.data.costPerVote ?? 0,
        financialExpensesPct: row.data.financialExpensesPct ?? 0,
        estimatedDonationsPct: row.data.estimatedDonationsPct ?? 0,
        expenses: row.data.expenses ?? ({} as Record<LegalExpenseCategory, number>),
        elected: false,
      }));
      
      const datasetId = await addDataset({
        name: trimmedName,
        year,
        state: trimmedState,
        position: trimmedPosition,
        candidacies,
        candidacyCount: candidacies.length,
        totalVotes: candidacies.reduce((s, c) => s + c.votes, 0),
        totalExpenses: candidacies.reduce((s, c) => s + c.totalExpenses, 0),
      });
      
      if (!datasetId) {
        toast.error('Erro ao salvar dataset no banco de dados. Tente novamente.');
        return;
      }
      
      toast.success(`${candidacies.length} candidaturas importadas com sucesso!`);
      
      setPastedData('');
      setParsedRows([]);
      setStep('paste');
      setFormData({ name: '', year: new Date().getFullYear().toString(), state: '', position: '' });
      onSuccess?.();
    } catch (error) {
      toast.error('Erro ao importar dados');
    } finally {
      setImporting(false);
    }
  };
  
  const handleReset = () => {
    setPastedData('');
    setParsedRows([]);
    setStep('paste');
  };
  
  return (
    <div className="space-y-6">
      {step === 'paste' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <ClipboardPaste className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Colar dados da planilha</h2>
              <p className="text-sm text-muted-foreground">
                Copie e cole os dados diretamente do Excel ou Google Sheets
              </p>
            </div>
          </div>
          
          <div className="paste-area">
            <textarea
              placeholder={`Cole aqui os dados da planilha...\n\nOrdem das colunas esperada:\n${COLUMN_ORDER.slice(0, 10).join(', ')}...\n\n(${COLUMN_ORDER.length} colunas no total, incluindo as categorias de despesa)`}
              value={pastedData}
              onChange={handleTextChange}
              onPaste={handlePaste}
              className="font-mono text-xs leading-relaxed"
            />
          </div>
          
          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-2">Formato esperado</p>
                <p className="text-muted-foreground text-xs mb-2">
                  A planilha deve conter {COLUMN_ORDER.length} colunas na ordem exata especificada.
                </p>
                <details className="cursor-pointer">
                  <summary className="text-primary hover:underline text-xs">
                    Ver lista completa de colunas
                  </summary>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                    {COLUMN_ORDER.map((col, i) => (
                      <li key={col} className="font-mono">{i + 1}. {col}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {step === 'validate' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Validação dos dados</h2>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="w-4 h-4 mr-2" />
              Recomeçar
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="metric-label">Linhas válidas</p>
                  <p className="text-2xl font-bold text-success">{valid.length}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="metric-label">Linhas com erro</p>
                  <p className="text-2xl font-bold text-destructive">{invalid.length}</p>
                </div>
              </div>
            </div>
          </div>
          
          {invalid.length > 0 && (
            <div className="glass-panel rounded-lg p-4 max-h-48 overflow-y-auto scrollbar-thin">
              <p className="text-sm font-medium text-destructive mb-3">Erros encontrados:</p>
              <ul className="space-y-2 text-xs">
                {invalid.slice(0, 10).map((row) => (
                  <li key={row.rowNumber} className="flex items-start gap-2">
                    <span className="chip chip-destructive">Linha {row.rowNumber}</span>
                    <span className="text-muted-foreground">{row.errors.join('; ')}</span>
                  </li>
                ))}
                {invalid.length > 10 && (
                  <li className="text-muted-foreground">...e mais {invalid.length - 10} erros</li>
                )}
              </ul>
            </div>
          )}
          
          {valid.length > 0 && (
            <div className="glass-panel rounded-lg p-4">
              <p className="text-sm font-medium mb-3">Prévia das candidaturas válidas:</p>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Candidatura</th>
                      <th>Partido</th>
                      <th>Votos</th>
                      <th>Total Gastos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valid.slice(0, 5).map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="font-medium">{row.data.name}</td>
                        <td><span className="chip chip-primary">{row.data.party}</span></td>
                        <td className="font-mono">{row.data.votes?.toLocaleString('pt-BR')}</td>
                        <td className="font-mono">
                          {row.data.totalExpenses?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {valid.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    ...e mais {valid.length - 5} candidaturas
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset}>Cancelar</Button>
            <Button onClick={handleProceed} disabled={valid.length === 0}>
              <Upload className="w-4 h-4 mr-2" />
              Continuar ({valid.length} candidaturas)
            </Button>
          </div>
        </div>
      )}
      
      {step === 'configure' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Configurar dataset</h2>
            <Button variant="ghost" size="sm" onClick={() => setStep('validate')}>Voltar</Button>
          </div>
          
          <DatasetConfigForm formData={formData} setFormData={setFormData} />
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep('validate')}>Voltar</Button>
            <Button 
              onClick={handleImport}
              disabled={!formData.name || !formData.state || !formData.position || importing}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {importing ? 'Importando...' : 'Importar dataset'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main DataImport Component ──

export const DataImport: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-end">
        <TokenTimer />
      </div>
      <Tabs defaultValue="file" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file" className="flex items-center gap-2">
            <FileUp className="w-4 h-4" />
            Upload de arquivo
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4" />
            Colar da planilha
          </TabsTrigger>
        </TabsList>
        <TabsContent value="file" className="mt-6">
          <FileUploadTab onSuccess={onSuccess} />
        </TabsContent>
        <TabsContent value="paste" className="mt-6">
          <PasteTab onSuccess={onSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

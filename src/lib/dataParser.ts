import { 
  Candidacy, 
  ParsedRow, 
  COLUMN_ORDER, 
  LEGAL_EXPENSE_CATEGORIES,
  type LegalExpenseCategory,
  type Gender,
  type Race,
  type Education
} from '@/types/campaign';

const normalizeGender = (value: string): Gender => {
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('masc') || normalized === 'm') return 'Masculino';
  if (normalized.includes('fem') || normalized === 'f') return 'Feminino';
  return 'Não informado';
};

const normalizeRace = (value: string): Race => {
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('branc')) return 'Branca';
  if (normalized.includes('pret')) return 'Preta';
  if (normalized.includes('pard')) return 'Parda';
  if (normalized.includes('amarel')) return 'Amarela';
  if (normalized.includes('indíg') || normalized.includes('indig')) return 'Indígena';
  return 'Não informado';
};

const normalizeEducation = (value: string): Education => {
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('pós') || normalized.includes('pos') || normalized.includes('mestrado') || normalized.includes('doutorado')) {
    return 'Pós-graduação';
  }
  if (normalized.includes('superior') && normalized.includes('complet')) return 'Superior completo';
  if (normalized.includes('superior') && normalized.includes('incomplet')) return 'Superior incompleto';
  if ((normalized.includes('médio') || normalized.includes('medio')) && normalized.includes('complet')) return 'Médio completo';
  if ((normalized.includes('médio') || normalized.includes('medio')) && normalized.includes('incomplet')) return 'Médio incompleto';
  if (normalized.includes('fundamental') && normalized.includes('complet')) return 'Fundamental completo';
  if (normalized.includes('fundamental') && normalized.includes('incomplet')) return 'Fundamental incompleto';
  return 'Não informado';
};

const parseNumber = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  // Handle Brazilian number format (1.234,56 -> 1234.56)
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

const generateId = () => Math.random().toString(36).substring(2, 15);

export const parseSpreadsheetData = (rawText: string): ParsedRow[] => {
  const lines = rawText.trim().split('\n');
  if (lines.length === 0) return [];
  
  // Skip header row if present
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('candidatura') || firstLine.includes('partido');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  return dataLines.map((line, index) => {
    const columns = line.split('\t');
    const errors: string[] = [];
    const rowNumber = hasHeader ? index + 2 : index + 1;
    
    // Validate column count
    if (columns.length < COLUMN_ORDER.length) {
      errors.push(`Número de colunas insuficiente: esperado ${COLUMN_ORDER.length}, recebido ${columns.length}`);
    }
    
    // Parse base fields
    const name = columns[0]?.trim() || '';
    const party = columns[1]?.trim() || '';
    const gender = normalizeGender(columns[2] || '');
    const race = normalizeRace(columns[3] || '');
    const education = normalizeEducation(columns[4] || '');
    const occupation = columns[5]?.trim() || 'Não informado';
    const votes = parseNumber(columns[6] || '0');
    const financialExpenses = parseNumber(columns[7] || '0');
    const estimatedDonations = parseNumber(columns[8] || '0');
    // Column 9 is "Total de gastos" - we'll recalculate it
    
    // Validate required fields
    if (!name) errors.push('Nome da candidatura é obrigatório');
    if (!party) errors.push('Partido é obrigatório');
    if (votes < 0) errors.push('Votos não pode ser negativo');
    
    // Parse expense categories
    const expenses: Partial<Record<LegalExpenseCategory, number>> = {};
    let calculatedCategoryTotal = 0;
    
    LEGAL_EXPENSE_CATEGORIES.forEach((category, catIndex) => {
      const columnIndex = 10 + catIndex; // Starts after first 10 columns
      const value = parseNumber(columns[columnIndex] || '0');
      expenses[category] = value;
      calculatedCategoryTotal += value;
    });
    
    // Calculate computed fields
    // Total expenses = financial (cash) + estimated donations (non-monetary)
    const totalExpenses = financialExpenses + estimatedDonations;
    const costPerVote = votes > 0 ? totalExpenses / votes : 0;
    
    // Calculate percentage breakdown
    const financialExpensesPct = totalExpenses > 0 ? financialExpenses / totalExpenses : 0;
    const estimatedDonationsPct = totalExpenses > 0 ? estimatedDonations / totalExpenses : 0;
    
    const candidacy: Partial<Candidacy> = {
      id: generateId(),
      name,
      party,
      gender,
      race,
      education,
      occupation,
      votes,
      financialExpenses,
      estimatedDonations,
      expenses: expenses as Record<LegalExpenseCategory, number>,
      totalExpenses,
      costPerVote,
      financialExpensesPct,
      estimatedDonationsPct,
    };
    
    return {
      rowNumber,
      data: candidacy,
      errors,
      isValid: errors.length === 0,
    };
  });
};

export const validateParsedData = (rows: ParsedRow[]): { valid: ParsedRow[]; invalid: ParsedRow[] } => {
  return {
    valid: rows.filter((r) => r.isValid),
    invalid: rows.filter((r) => !r.isValid),
  };
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatNumber = (value: number, decimals = 0): string => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatPercentage = (value: number, decimals = 1): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const calculatePercentile = (value: number, allValues: number[]): number => {
  const sorted = [...allValues].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= value);
  return ((index + 1) / sorted.length) * 100;
};

export const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

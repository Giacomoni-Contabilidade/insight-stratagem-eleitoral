// Legal expense categories as defined by electoral legislation
export const LEGAL_EXPENSE_CATEGORIES = [
  "Água",
  "Alimentação",
  "Aquisição/Doação de bens móveis ou imóveis",
  "Atividades de militância e mobilização de rua",
  "Cessão ou locação de veículos",
  "Combustíveis e lubrificantes",
  "Comícios",
  "Correspondências e despesas postais",
  "Criação e inclusão de páginas na internet",
  "Despesa com Impulsionamento de Conteúdos",
  "Despesas com Hospedagem",
  "Despesas com pessoal",
  "Despesas com transporte ou deslocamento",
  "Diversas a especificar",
  "Doações financeiras a outros candidatos/partidos",
  "Encargos financeiros, taxas bancárias e/ou operações com cartão de crédito",
  "Encargos sociais",
  "Energia elétrica",
  "Eventos de promoção da candidatura",
  "Impostos, contribuições e taxas",
  "Locação/cessão de bens imóveis",
  "Locação/cessão de bens móveis (exceto veículos)",
  "Materiais de expediente",
  "Pesquisas ou testes eleitorais",
  "Pré-instalação física de comitê de campanha",
  "Produção de jingles, vinhetas e slogans",
  "Produção de programas de rádio, televisão ou vídeo",
  "Publicidade por adesivos",
  "Publicidade por carros de som",
  "Publicidade por jornais e revistas",
  "Publicidade por materiais impressos",
  "Reembolsos de gastos realizados por eleitores",
  "Serviços advocatícios",
  "Serviços contábeis",
  "Serviços prestados por terceiros",
  "Serviços próprios prestados por terceiros",
  "Taxa de Administração de Financiamento Coletivo",
  "Telefone",
] as const;

export type LegalExpenseCategory = typeof LEGAL_EXPENSE_CATEGORIES[number];

// Enum types for standardized fields
export type Gender = "Masculino" | "Feminino" | "Não informado";
export type Race = "Branca" | "Preta" | "Parda" | "Amarela" | "Indígena" | "Não informado";
export type Education = 
  | "Fundamental incompleto"
  | "Fundamental completo"
  | "Médio incompleto"
  | "Médio completo"
  | "Superior incompleto"
  | "Superior completo"
  | "Pós-graduação"
  | "Não informado";

// Raw candidacy data structure
export interface Candidacy {
  id: string;
  datasetId: string;
  name: string;
  party: string;
  gender: Gender;
  race: Race;
  education: Education;
  occupation: string;
  votes: number;
  // Financial expenses = paid in money
  financialExpenses: number;
  // Estimated donations = non-monetary contributions (volunteer work, donated services)
  estimatedDonations: number;
  expenses: Record<LegalExpenseCategory, number>;
  // Computed fields
  totalExpenses: number; // financialExpenses + estimatedDonations
  costPerVote: number;
  // Percentage breakdown
  financialExpensesPct: number; // % of total that was paid in money
  estimatedDonationsPct: number; // % of total from non-monetary donations
}

// Dataset metadata
export interface Dataset {
  id: string;
  name: string;
  year: number;
  state: string;
  position: string;
  candidacies: Candidacy[];
  candidacyCount: number; // lightweight count fetched without loading all candidacies
  createdAt: Date;
  updatedAt: Date;
}

// Analytical grouping structure
export interface AnalyticalGroup {
  id: string;
  name: string;
  categories: LegalExpenseCategory[];
  color?: string;
}

// Parsed row from spreadsheet paste
export interface ParsedRow {
  rowNumber: number;
  data: Partial<Candidacy>;
  errors: string[];
  isValid: boolean;
}

// Stats summary for groups
export interface GroupStats {
  groupName: string;
  groupValue: string;
  count: number;
  totalVotes: number;
  totalExpenses: number;
  totalFinancialExpenses: number;
  totalEstimatedDonations: number;
  averageCostPerVote: number;
  medianCostPerVote: number;
}

// Filter state for dashboards
export interface FilterState {
  parties: string[];
  genders: Gender[];
  races: Race[];
  educations: Education[];
  occupations: string[];
  minVotes?: number;
  maxVotes?: number;
  minExpenses?: number;
  maxExpenses?: number;
}

// Column order for paste validation
export const COLUMN_ORDER = [
  "Candidatura",
  "Partido",
  "Genero",
  "Raça_cor",
  "Ensino",
  "Ocupacao",
  "Votos",
  "Despesas_Financeiras",
  "Doacoes_Estimadas",
  "Total de gastos",
  ...LEGAL_EXPENSE_CATEGORIES,
] as const;

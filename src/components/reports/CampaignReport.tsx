import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { styles, colors } from './PDFStyles';
import { Candidacy, Dataset, LEGAL_EXPENSE_CATEGORIES, LegalExpenseCategory } from '@/types/campaign';
import { formatCurrency, formatNumber, calculateMedian } from '@/lib/dataParser';

export interface ReportSections {
  summary: boolean;
  rankings: boolean;
  comparison: boolean;
  distributions: boolean;
  expenseTypes: boolean;
  expenseChampions: boolean;
}

interface ReportProps {
  dataset: Dataset;
  sections: ReportSections;
  selectedCandidacies?: Candidacy[];
  generatedAt: Date;
  clientName?: string;
}

// Cover Page Component
const CoverPage: React.FC<{ dataset: Dataset; generatedAt: Date; clientName?: string }> = ({ 
  dataset, 
  generatedAt,
  clientName 
}) => (
  <Page size="A4" style={styles.coverPage}>
    <View style={styles.coverContent}>
      <Text style={styles.coverTitle}>Relatório de Análise</Text>
      <Text style={styles.coverTitle}>de Campanha Eleitoral</Text>
      <Text style={styles.coverSubtitle}>{dataset.name}</Text>
      <Text style={[styles.coverMeta, { marginTop: 40 }]}>
        {dataset.position} • {dataset.state} • {dataset.year}
      </Text>
      <Text style={styles.coverMeta}>
        {dataset.candidacies.length} candidaturas analisadas
      </Text>
      {clientName && (
        <Text style={[styles.coverMeta, { marginTop: 30 }]}>
          Preparado para: {clientName}
        </Text>
      )}
      <Text style={[styles.coverMeta, { marginTop: 20 }]}>
        Gerado em: {generatedAt.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        })}
      </Text>
    </View>
  </Page>
);

// Page Header Component
const PageHeader: React.FC<{ title: string; datasetName: string }> = ({ title, datasetName }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{title}</Text>
    <Text style={styles.headerDate}>{datasetName}</Text>
  </View>
);

// Page Footer Component
const PageFooter: React.FC = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>CampanhaAnalytics</Text>
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
      `Página ${pageNumber} de ${totalPages}`
    )} />
  </View>
);

// Stat Card Component
const StatCard: React.FC<{ label: string; value: string; subvalue?: string }> = ({ 
  label, 
  value, 
  subvalue 
}) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    {subvalue && <Text style={styles.statSubvalue}>{subvalue}</Text>}
  </View>
);

// Summary Section
const SummarySection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  const totalVotes = candidacies.reduce((sum, c) => sum + c.votes, 0);
  const totalExpenses = candidacies.reduce((sum, c) => sum + c.totalExpenses, 0);
  const totalFinancial = candidacies.reduce((sum, c) => sum + c.financialExpenses, 0);
  const totalDonations = candidacies.reduce((sum, c) => sum + c.estimatedDonations, 0);
  
  const avgCostPerVote = totalVotes > 0 ? totalExpenses / totalVotes : 0;
  const medianCostPerVote = calculateMedian(
    candidacies.filter(c => c.votes > 0).map(c => c.costPerVote)
  );
  
  const avgVotes = totalVotes / candidacies.length;
  const avgExpenses = totalExpenses / candidacies.length;

  return (
    <View>
      <Text style={styles.sectionTitle}>Resumo Geral</Text>
      
      <View style={styles.statsGrid}>
        <StatCard 
          label="Total de Candidaturas" 
          value={formatNumber(candidacies.length, 0)} 
        />
        <StatCard 
          label="Total de Votos" 
          value={formatNumber(totalVotes, 0)} 
          subvalue={`Média: ${formatNumber(avgVotes, 0)} por candidatura`}
        />
        <StatCard 
          label="Total de Gastos" 
          value={formatCurrency(totalExpenses)} 
          subvalue={`Média: ${formatCurrency(avgExpenses)}`}
        />
        <StatCard 
          label="Despesas Financeiras" 
          value={formatCurrency(totalFinancial)} 
          subvalue={`${((totalFinancial / totalExpenses) * 100).toFixed(1)}% do total`}
        />
        <StatCard 
          label="Doações Estimadas" 
          value={formatCurrency(totalDonations)} 
          subvalue={`${((totalDonations / totalExpenses) * 100).toFixed(1)}% do total`}
        />
        <StatCard 
          label="Custo Médio por Voto" 
          value={formatCurrency(avgCostPerVote)} 
          subvalue={`Mediana: ${formatCurrency(medianCostPerVote)}`}
        />
      </View>
    </View>
  );
};

// Ranking Item Component
const RankingItem: React.FC<{ 
  position: number; 
  name: string; 
  party: string; 
  value: string;
}> = ({ position, name, party, value }) => {
  const positionStyle = [
    styles.rankingPosition,
    position === 1 && styles.rankingPositionGold,
    position === 2 && styles.rankingPositionSilver,
    position === 3 && styles.rankingPositionBronze,
  ].filter(Boolean);

  return (
    <View style={styles.rankingItem}>
      <View style={positionStyle as any}>
        <Text style={styles.rankingPositionText}>{position}</Text>
      </View>
      <Text style={styles.rankingName}>{name}</Text>
      <Text style={styles.rankingParty}>{party}</Text>
      <Text style={styles.rankingValue}>{value}</Text>
    </View>
  );
};

// Rankings Section
const RankingsSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  const withVotes = candidacies.filter(c => c.votes > 0);
  
  const mostVoted = [...candidacies].sort((a, b) => b.votes - a.votes).slice(0, 10);
  const leastVoted = [...candidacies].sort((a, b) => a.votes - b.votes).slice(0, 10);
  const cheapestVotes = [...withVotes].sort((a, b) => a.costPerVote - b.costPerVote).slice(0, 10);
  const expensiveVotes = [...withVotes].sort((a, b) => b.costPerVote - a.costPerVote).slice(0, 10);
  const mostExpenses = [...candidacies].sort((a, b) => b.totalExpenses - a.totalExpenses).slice(0, 10);
  const leastExpenses = [...candidacies].sort((a, b) => a.totalExpenses - b.totalExpenses).slice(0, 10);

  return (
    <View>
      <Text style={styles.sectionTitle}>Rankings 10+</Text>
      
      <View style={styles.twoColumnGrid}>
        <View style={styles.column}>
          <View style={styles.rankingContainer}>
            <Text style={styles.rankingTitle}>🏆 Mais Votados</Text>
            {mostVoted.map((c, i) => (
              <RankingItem 
                key={c.id} 
                position={i + 1} 
                name={c.name} 
                party={c.party}
                value={formatNumber(c.votes, 0)}
              />
            ))}
          </View>
          
          <View style={styles.rankingContainer}>
            <Text style={styles.rankingTitle}>💰 Maiores Gastos</Text>
            {mostExpenses.map((c, i) => (
              <RankingItem 
                key={c.id} 
                position={i + 1} 
                name={c.name} 
                party={c.party}
                value={formatCurrency(c.totalExpenses)}
              />
            ))}
          </View>
          
          <View style={styles.rankingContainer}>
            <Text style={styles.rankingTitle}>📉 Votos Mais Baratos</Text>
            {cheapestVotes.map((c, i) => (
              <RankingItem 
                key={c.id} 
                position={i + 1} 
                name={c.name} 
                party={c.party}
                value={formatCurrency(c.costPerVote)}
              />
            ))}
          </View>
        </View>
        
        <View style={styles.column}>
          <View style={styles.rankingContainer}>
            <Text style={styles.rankingTitle}>📊 Menos Votados</Text>
            {leastVoted.map((c, i) => (
              <RankingItem 
                key={c.id} 
                position={i + 1} 
                name={c.name} 
                party={c.party}
                value={formatNumber(c.votes, 0)}
              />
            ))}
          </View>
          
          <View style={styles.rankingContainer}>
            <Text style={styles.rankingTitle}>💵 Menores Gastos</Text>
            {leastExpenses.map((c, i) => (
              <RankingItem 
                key={c.id} 
                position={i + 1} 
                name={c.name} 
                party={c.party}
                value={formatCurrency(c.totalExpenses)}
              />
            ))}
          </View>
          
          <View style={styles.rankingContainer}>
            <Text style={styles.rankingTitle}>📈 Votos Mais Caros</Text>
            {expensiveVotes.map((c, i) => (
              <RankingItem 
                key={c.id} 
                position={i + 1} 
                name={c.name} 
                party={c.party}
                value={formatCurrency(c.costPerVote)}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

// Bar Chart Component
const BarChart: React.FC<{ 
  title: string; 
  data: { label: string; value: number; color?: string }[];
  formatValue?: (v: number) => string;
}> = ({ title, data, formatValue = (v) => formatNumber(v, 0) }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const chartColors = [colors.primary, colors.secondary, colors.accent, '#d57a55', '#8fbc8f', colors.destructive];
  
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      {data.slice(0, 10).map((item, index) => (
        <View key={item.label} style={styles.barChartRow}>
          <Text style={styles.barLabel}>{item.label.length > 15 ? item.label.substring(0, 15) + '...' : item.label}</Text>
          <View style={styles.barContainer}>
            <View style={[
              styles.bar, 
              { 
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: item.color || chartColors[index % chartColors.length]
              }
            ]} />
          </View>
          <Text style={styles.barValue}>{formatValue(item.value)}</Text>
        </View>
      ))}
    </View>
  );
};

// Distributions Section
const DistributionsSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  // By party
  const byParty = candidacies.reduce((acc, c) => {
    acc[c.party] = (acc[c.party] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const partyData = Object.entries(byParty)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  // By gender
  const byGender = candidacies.reduce((acc, c) => {
    acc[c.gender] = (acc[c.gender] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const genderData = Object.entries(byGender)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  // By education
  const byEducation = candidacies.reduce((acc, c) => {
    acc[c.education] = (acc[c.education] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const educationData = Object.entries(byEducation)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  // Expenses by party
  const expensesByParty = candidacies.reduce((acc, c) => {
    acc[c.party] = (acc[c.party] || 0) + c.totalExpenses;
    return acc;
  }, {} as Record<string, number>);
  
  const partyExpenseData = Object.entries(expensesByParty)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  return (
    <View>
      <Text style={styles.sectionTitle}>Distribuições</Text>
      
      <View style={styles.twoColumnGrid}>
        <View style={styles.column}>
          <BarChart title="Candidaturas por Partido" data={partyData} />
          <BarChart title="Candidaturas por Gênero" data={genderData} />
        </View>
        <View style={styles.column}>
          <BarChart title="Candidaturas por Escolaridade" data={educationData} />
          <BarChart 
            title="Gastos por Partido (Top 10)" 
            data={partyExpenseData} 
            formatValue={formatCurrency}
          />
        </View>
      </View>
    </View>
  );
};

// Comparison Section
const ComparisonSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  if (candidacies.length === 0) return null;
  
  const metrics = [
    { label: 'Votos', getValue: (c: Candidacy) => formatNumber(c.votes, 0) },
    { label: 'Custo por Voto', getValue: (c: Candidacy) => formatCurrency(c.costPerVote) },
    { label: 'Gastos Totais', getValue: (c: Candidacy) => formatCurrency(c.totalExpenses) },
    { label: 'Despesas Financeiras', getValue: (c: Candidacy) => formatCurrency(c.financialExpenses) },
    { label: 'Doações Estimadas', getValue: (c: Candidacy) => formatCurrency(c.estimatedDonations) },
    { label: 'Partido', getValue: (c: Candidacy) => c.party },
    { label: 'Gênero', getValue: (c: Candidacy) => c.gender },
    { label: 'Escolaridade', getValue: (c: Candidacy) => c.education },
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>Comparativo de Candidaturas</Text>
      
      <View style={styles.comparisonTable}>
        {/* Header row with candidate names */}
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonLabel}>
            <Text style={{ fontWeight: 600 }}>Métrica</Text>
          </View>
          {candidacies.map(c => (
            <View key={c.id} style={[styles.comparisonCell, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.white, fontWeight: 600, fontSize: 8 }}>
                {c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name}
              </Text>
            </View>
          ))}
        </View>
        
        {/* Metric rows */}
        {metrics.map((metric, idx) => (
          <View key={metric.label} style={[styles.comparisonRow, idx % 2 === 1 && { backgroundColor: colors.background }]}>
            <View style={styles.comparisonLabel}>
              <Text>{metric.label}</Text>
            </View>
            {candidacies.map(c => (
              <View key={c.id} style={styles.comparisonCell}>
                <Text>{metric.getValue(c)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

// Expense Types Analysis Section
const ExpenseTypesSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  // Calculate total per expense category
  const categoryTotals = LEGAL_EXPENSE_CATEGORIES.map(category => {
    const total = candidacies.reduce((sum, c) => sum + (c.expenses[category] || 0), 0);
    return { category, total };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const grandTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
  const top10Categories = categoryTotals.slice(0, 10);
  const top20Categories = categoryTotals.slice(0, 20);

  // Calculate average per category
  const categoryAverages = top10Categories.map(({ category, total }) => ({
    category,
    average: total / candidacies.length,
    percentage: (total / grandTotal) * 100
  }));

  return (
    <View>
      <Text style={styles.sectionTitle}>Análise de Tipos de Despesas</Text>
      
      <View style={styles.statsGrid}>
        <StatCard 
          label="Categorias com Gastos" 
          value={String(categoryTotals.length)} 
          subvalue={`de ${LEGAL_EXPENSE_CATEGORIES.length} possíveis`}
        />
        <StatCard 
          label="Total Geral" 
          value={formatCurrency(grandTotal)} 
        />
        <StatCard 
          label="Top 3 Concentram" 
          value={`${((top10Categories.slice(0, 3).reduce((s, c) => s + c.total, 0) / grandTotal) * 100).toFixed(1)}%`}
          subvalue="do total de gastos"
        />
      </View>

      <View style={styles.twoColumnGrid}>
        <View style={styles.column}>
          <BarChart 
            title="Top 10 Categorias de Despesa" 
            data={top10Categories.map(({ category, total }) => ({
              label: category.length > 20 ? category.substring(0, 20) + '...' : category,
              value: total
            }))}
            formatValue={formatCurrency}
          />
        </View>
        <View style={styles.column}>
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Distribuição Percentual (Top 10)</Text>
            {categoryAverages.map((item, index) => (
              <View key={item.category} style={styles.barChartRow}>
                <Text style={[styles.barLabel, { width: 120 }]}>
                  {item.category.length > 18 ? item.category.substring(0, 18) + '...' : item.category}
                </Text>
                <View style={styles.barContainer}>
                  <View style={[
                    styles.bar, 
                    { 
                      width: `${item.percentage}%`,
                      backgroundColor: [colors.primary, colors.secondary, colors.accent, '#d57a55', '#8fbc8f', colors.destructive][index % 6]
                    }
                  ]} />
                </View>
                <Text style={styles.barValue}>{item.percentage.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Full List Table */}
      <Text style={styles.subsectionTitle}>Todas as Categorias com Gastos</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '50%' }]}>Categoria</Text>
          <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>Total</Text>
          <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>% do Total</Text>
        </View>
        {top20Categories.map((item, idx) => (
          <View key={item.category} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
            <Text style={[styles.tableCell, { width: '50%' }]}>{item.category}</Text>
            <Text style={[styles.tableCell, { width: '25%', textAlign: 'right' }]}>{formatCurrency(item.total)}</Text>
            <Text style={[styles.tableCell, { width: '25%', textAlign: 'right' }]}>{((item.total / grandTotal) * 100).toFixed(1)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Expense Champions Section - Who spent most in each category
const ExpenseChampionsSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  // Find champion for each expense category
  const champions = LEGAL_EXPENSE_CATEGORIES.map(category => {
    const sorted = [...candidacies].sort((a, b) => (b.expenses[category] || 0) - (a.expenses[category] || 0));
    const champion = sorted[0];
    const championValue = champion?.expenses[category] || 0;
    const totalCategory = candidacies.reduce((sum, c) => sum + (c.expenses[category] || 0), 0);
    
    return {
      category,
      champion: champion?.name || '-',
      party: champion?.party || '-',
      value: championValue,
      totalCategory,
      percentOfCategory: totalCategory > 0 ? (championValue / totalCategory) * 100 : 0
    };
  }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  const top15Champions = champions.slice(0, 15);

  // Find candidates that are champions in multiple categories
  const championCounts = champions.reduce((acc, c) => {
    acc[c.champion] = (acc[c.champion] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const multiChampions = Object.entries(championCounts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <View>
      <Text style={styles.sectionTitle}>Campeões de Gastos por Categoria</Text>
      
      {multiChampions.length > 0 && (
        <View style={[styles.noteBox, { marginBottom: 16, backgroundColor: '#e0f2fe' }]}>
          <Text style={[styles.noteText, { color: colors.primary, fontWeight: 600, marginBottom: 4 }]}>
            Candidaturas com liderança em múltiplas categorias:
          </Text>
          {multiChampions.map(([name, count]) => (
            <Text key={name} style={[styles.noteText, { color: '#0369a1' }]}>
              • {name}: líder em {count} categorias
            </Text>
          ))}
        </View>
      )}

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Categoria</Text>
          <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Campeão</Text>
          <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Partido</Text>
          <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>Valor</Text>
          <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>% Cat.</Text>
        </View>
        {top15Champions.map((item, idx) => (
          <View key={item.category} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
            <Text style={[styles.tableCell, { width: '35%' }]}>
              {item.category.length > 30 ? item.category.substring(0, 30) + '...' : item.category}
            </Text>
            <Text style={[styles.tableCellBold, { width: '25%' }]}>
              {item.champion.length > 20 ? item.champion.substring(0, 20) + '...' : item.champion}
            </Text>
            <Text style={[styles.tableCell, { width: '10%' }]}>{item.party}</Text>
            <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>{formatCurrency(item.value)}</Text>
            <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>{item.percentOfCategory.toFixed(1)}%</Text>
          </View>
        ))}
      </View>

      {/* Top 5 Comparison Bar Chart */}
      <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>Top 5 Maiores Valores por Categoria</Text>
      <BarChart 
        title="" 
        data={top15Champions.slice(0, 5).map(c => ({
          label: `${c.champion.substring(0, 12)}... (${c.category.substring(0, 15)}...)`,
          value: c.value
        }))}
        formatValue={formatCurrency}
      />
    </View>
  );
};

// Main Report Document
export const CampaignReport: React.FC<ReportProps> = ({
  dataset,
  sections,
  selectedCandidacies = [],
  generatedAt,
  clientName,
}) => {
  const { candidacies } = dataset;

  return (
    <Document>
      {/* Cover Page */}
      <CoverPage dataset={dataset} generatedAt={generatedAt} clientName={clientName} />
      
      {/* Summary Page */}
      {sections.summary && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Resumo Geral" datasetName={dataset.name} />
          <SummarySection candidacies={candidacies} />
          <PageFooter />
        </Page>
      )}
      
      {/* Rankings Pages */}
      {sections.rankings && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Rankings 10+" datasetName={dataset.name} />
          <RankingsSection candidacies={candidacies} />
          <PageFooter />
        </Page>
      )}

      {/* Expense Types Page */}
      {sections.expenseTypes && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Tipos de Despesas" datasetName={dataset.name} />
          <ExpenseTypesSection candidacies={candidacies} />
          <PageFooter />
        </Page>
      )}

      {/* Expense Champions Page */}
      {sections.expenseChampions && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Campeões por Categoria" datasetName={dataset.name} />
          <ExpenseChampionsSection candidacies={candidacies} />
          <PageFooter />
        </Page>
      )}
      
      {/* Distributions Page */}
      {sections.distributions && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Distribuições" datasetName={dataset.name} />
          <DistributionsSection candidacies={candidacies} />
          <PageFooter />
        </Page>
      )}
      
      {/* Comparison Page */}
      {sections.comparison && selectedCandidacies.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Comparativo" datasetName={dataset.name} />
          <ComparisonSection candidacies={selectedCandidacies} />
          <PageFooter />
        </Page>
      )}
    </Document>
  );
};

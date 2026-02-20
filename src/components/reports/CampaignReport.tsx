import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { styles, colors } from './PDFStyles';
import { Candidacy, Dataset, LEGAL_EXPENSE_CATEGORIES, LegalExpenseCategory, AnalyticalGroup } from '@/types/campaign';
import { formatCurrency, formatNumber, calculateMedian } from '@/lib/dataParser';

export interface ReportSections {
  summary: boolean;
  rankings: boolean;
  comparison: boolean;
  distributions: boolean;
  expenseTypes: boolean;
  expenseChampions: boolean;
  analyticalGroups: boolean;
}

interface ReportProps {
  dataset: Dataset;
  sections: ReportSections;
  selectedCandidacies?: Candidacy[];
  analyticalGroups?: AnalyticalGroup[];
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

// Helper to compute summary stats
const computeStats = (candidacies: Candidacy[]) => {
  const totalVotes = candidacies.reduce((sum, c) => sum + c.votes, 0);
  const totalExpenses = candidacies.reduce((sum, c) => sum + c.totalExpenses, 0);
  const totalFinancial = candidacies.reduce((sum, c) => sum + c.financialExpenses, 0);
  const totalDonations = candidacies.reduce((sum, c) => sum + c.estimatedDonations, 0);
  const avgCostPerVote = totalVotes > 0 ? totalExpenses / totalVotes : 0;
  const medianCostPerVote = calculateMedian(candidacies.filter(c => c.votes > 0).map(c => c.costPerVote));
  const avgVotes = candidacies.length > 0 ? totalVotes / candidacies.length : 0;
  const avgExpenses = candidacies.length > 0 ? totalExpenses / candidacies.length : 0;
  return { totalVotes, totalExpenses, totalFinancial, totalDonations, avgCostPerVote, medianCostPerVote, avgVotes, avgExpenses };
};

// Summary sub-block
const SummaryBlock: React.FC<{ title: string; candidacies: Candidacy[] }> = ({ title, candidacies }) => {
  const s = computeStats(candidacies);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.subsectionTitle}>{title} ({formatNumber(candidacies.length, 0)} candidaturas)</Text>
      <View style={styles.statsGrid}>
        <StatCard label="Total de Votos" value={formatNumber(s.totalVotes, 0)} subvalue={`Média: ${formatNumber(s.avgVotes, 0)}`} />
        <StatCard label="Total de Gastos" value={formatCurrency(s.totalExpenses)} subvalue={`Média: ${formatCurrency(s.avgExpenses)}`} />
        <StatCard label="Despesas Financeiras" value={formatCurrency(s.totalFinancial)} subvalue={s.totalExpenses > 0 ? `${((s.totalFinancial / s.totalExpenses) * 100).toFixed(1)}% do total` : '0%'} />
        <StatCard label="Doações Estimadas" value={formatCurrency(s.totalDonations)} subvalue={s.totalExpenses > 0 ? `${((s.totalDonations / s.totalExpenses) * 100).toFixed(1)}% do total` : '0%'} />
        <StatCard label="Custo Médio/Voto" value={formatCurrency(s.avgCostPerVote)} subvalue={`Mediana: ${formatCurrency(s.medianCostPerVote)}`} />
      </View>
    </View>
  );
};

// Summary Section - split by elected/not-elected/general
const SummarySection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  const elected = candidacies.filter(c => c.elected);
  const notElected = candidacies.filter(c => !c.elected);

  return (
    <View>
      <Text style={styles.sectionTitle}>Resumo Geral</Text>
      <SummaryBlock title="Geral" candidacies={candidacies} />
      <SummaryBlock title="Eleitos" candidacies={elected} />
      <SummaryBlock title="Não Eleitos" candidacies={notElected} />
    </View>
  );
};

// Ranking Item Component
const RankingItem: React.FC<{ 
  position: number; 
  name: string; 
  party: string; 
  value: string;
  elected?: boolean;
  showElected?: boolean;
}> = ({ position, name, party, value, elected, showElected }) => {
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
      {showElected && (
        <Text style={[styles.rankingParty, { color: elected ? colors.success : colors.muted }]}>
          {elected ? 'Eleito' : 'Nao'}
        </Text>
      )}
      <Text style={styles.rankingValue}>{value}</Text>
    </View>
  );
};

// Rankings Section
const RankingsSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  const withVotes = candidacies.filter(c => c.votes > 0);
  const elected = candidacies.filter(c => c.elected);
  const electedWithVotes = elected.filter(c => c.votes > 0);
  const notElectedWithVotes = withVotes.filter(c => !c.elected);
  
  const mostVoted = [...candidacies].sort((a, b) => b.votes - a.votes).slice(0, 20);
  const leastVotedElected = [...elected].sort((a, b) => a.votes - b.votes).slice(0, 10);
  const cheapestVotesElected = [...electedWithVotes].sort((a, b) => a.costPerVote - b.costPerVote).slice(0, 10);
  const expensiveVotesElected = [...electedWithVotes].sort((a, b) => b.costPerVote - a.costPerVote).slice(0, 10);
  const expensiveVotesNotElected = [...notElectedWithVotes].sort((a, b) => b.costPerVote - a.costPerVote).slice(0, 10);
  const mostExpenses = [...candidacies].sort((a, b) => b.totalExpenses - a.totalExpenses).slice(0, 20);
  const leastExpensesElected = [...elected].sort((a, b) => a.totalExpenses - b.totalExpenses).slice(0, 10);

  return (
    <View>
      <Text style={styles.sectionTitle}>Rankings</Text>
      
      {/* Most Voted - Top 20 */}
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitle}>Top 20 Mais Votados</Text>
        {mostVoted.map((c, i) => (
          <RankingItem key={c.id} position={i + 1} name={c.name} party={c.party} value={formatNumber(c.votes, 0)} elected={c.elected} showElected />
        ))}
      </View>

      {/* Least Voted - Elected only */}
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitle}>Menos Votados (Eleitos)</Text>
        {leastVotedElected.map((c, i) => (
          <RankingItem key={c.id} position={i + 1} name={c.name} party={c.party} value={formatNumber(c.votes, 0)} />
        ))}
      </View>

      {/* Most Expenses - Top 20 with elected column */}
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitle}>Top 20 Maiores Gastos</Text>
        {mostExpenses.map((c, i) => (
          <RankingItem key={c.id} position={i + 1} name={c.name} party={c.party} value={formatCurrency(c.totalExpenses)} elected={c.elected} showElected />
        ))}
      </View>

      {/* Least Expenses - Elected only */}
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitle}>Menores Gastos (Eleitos)</Text>
        {leastExpensesElected.map((c, i) => (
          <RankingItem key={c.id} position={i + 1} name={c.name} party={c.party} value={formatCurrency(c.totalExpenses)} />
        ))}
      </View>

      {/* Expensive votes - Elected */}
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitle}>Votos Mais Caros (Eleitos)</Text>
        {expensiveVotesElected.map((c, i) => (
          <RankingItem key={c.id} position={i + 1} name={c.name} party={c.party} value={formatCurrency(c.costPerVote)} />
        ))}
      </View>

      {/* Expensive votes - Not Elected */}
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitle}>Votos Mais Caros (Não Eleitos)</Text>
        {expensiveVotesNotElected.map((c, i) => (
          <RankingItem key={c.id} position={i + 1} name={c.name} party={c.party} value={formatCurrency(c.costPerVote)} />
        ))}
      </View>

      {/* Cheapest votes - Elected only */}
      <View style={styles.rankingContainer}>
        <Text style={styles.rankingTitle}>Votos Mais Baratos (Eleitos)</Text>
        {cheapestVotesElected.map((c, i) => (
          <RankingItem key={c.id} position={i + 1} name={c.name} party={c.party} value={formatCurrency(c.costPerVote)} />
        ))}
      </View>
    </View>
  );
};

// Bar Chart Component
const BarChartPDF: React.FC<{ 
  title: string; 
  data: { label: string; value: number; color?: string }[];
  formatValue?: (v: number) => string;
  maxItems?: number;
}> = ({ title, data, formatValue = (v) => formatNumber(v, 0), maxItems = 10 }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartColors = [colors.primary, colors.secondary, colors.accent, '#d57a55', '#8fbc8f', colors.destructive];
  
  if (data.length === 0) return null;
  
  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      {data.slice(0, maxItems).map((item, index) => {
        const widthPercent = maxValue > 0 ? Math.min((item.value / maxValue) * 100, 100) : 0;
        return (
          <View key={item.label} style={styles.barChartRow}>
            <Text style={styles.barLabel}>{item.label.length > 15 ? item.label.substring(0, 15) + '...' : item.label}</Text>
            <View style={styles.barContainer}>
              <View style={[
                styles.bar, 
                { 
                  width: `${widthPercent}%`,
                  backgroundColor: item.color || chartColors[index % chartColors.length]
                }
              ]} />
            </View>
            <Text style={styles.barValue}>{formatValue(item.value)}</Text>
          </View>
        );
      })}
    </View>
  );
};

// Distributions Section
const DistributionsSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  // By party - ALL parties
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

  // By race
  const byRace = candidacies.reduce((acc, c) => {
    acc[c.race] = (acc[c.race] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const raceData = Object.entries(byRace)
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

  // Expenses by party - ALL parties
  const expensesByParty = candidacies.reduce((acc, c) => {
    acc[c.party] = (acc[c.party] || 0) + c.totalExpenses;
    return acc;
  }, {} as Record<string, number>);
  
  const partyExpenseData = Object.entries(expensesByParty)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  return (
    <View>
      <Text style={styles.sectionTitle}>Distribuições</Text>
      
      <BarChartPDF title="Candidaturas por Partido" data={partyData} maxItems={50} />
      <BarChartPDF title="Gastos por Partido" data={partyExpenseData} formatValue={formatCurrency} maxItems={50} />
      <BarChartPDF title="Candidaturas por Raça" data={raceData} />
      <BarChartPDF title="Candidaturas por Gênero" data={genderData} />
      <BarChartPDF title="Candidaturas por Escolaridade" data={educationData} />
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
    { label: 'Eleito', getValue: (c: Candidacy) => c.elected ? 'Sim' : 'Não' },
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>Comparativo de Candidaturas</Text>
      
      <View style={styles.comparisonTable}>
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
        
        {metrics.map((metric, idx) => (
          <View key={metric.label} style={[styles.comparisonRow, ...(idx % 2 === 1 ? [{ backgroundColor: colors.background }] : [])]}>
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

// Expense Types Analysis Section - split by elected/not elected
const ExpenseTypesSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  const elected = candidacies.filter(c => c.elected);
  const notElected = candidacies.filter(c => !c.elected);

  const renderForGroup = (group: Candidacy[], groupLabel: string) => {
    const categoryTotals = LEGAL_EXPENSE_CATEGORIES.map(category => {
      const total = group.reduce((sum, c) => sum + (c.expenses[category] || 0), 0);
      return { category, total };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

    const grandTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
    const top10Categories = categoryTotals.slice(0, 10);
    const top20Categories = categoryTotals.slice(0, 20);

    if (group.length === 0) return null;

    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.subsectionTitle}>{groupLabel} ({formatNumber(group.length, 0)} candidaturas)</Text>
        
        <View style={styles.statsGrid}>
          <StatCard label="Categorias com Gastos" value={String(categoryTotals.length)} subvalue={`de ${LEGAL_EXPENSE_CATEGORIES.length} possíveis`} />
          <StatCard label="Total Geral" value={formatCurrency(grandTotal)} />
          <StatCard label="Top 3 Concentram" value={grandTotal > 0 ? `${((top10Categories.slice(0, 3).reduce((s, c) => s + c.total, 0) / grandTotal) * 100).toFixed(1)}%` : '0%'} subvalue="do total de gastos" />
        </View>

        <BarChartPDF 
          title={`Top 10 Categorias - ${groupLabel}`}
          data={top10Categories.map(({ category, total }) => ({
            label: category.length > 20 ? category.substring(0, 20) + '...' : category,
            value: total
          }))}
          formatValue={formatCurrency}
        />

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: '50%' }]}>Categoria</Text>
            <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>Total</Text>
            <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>% do Total</Text>
          </View>
          {top20Categories.map((item, idx) => {
            const percentOfTotal = grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : '0.0';
            return (
              <View key={item.category} style={[styles.tableRow, ...(idx % 2 === 1 ? [styles.tableRowAlt] : [])]}>
                <Text style={[styles.tableCell, { width: '50%' }]}>{item.category}</Text>
                <Text style={[styles.tableCell, { width: '25%', textAlign: 'right' }]}>{formatCurrency(item.total)}</Text>
                <Text style={[styles.tableCell, { width: '25%', textAlign: 'right' }]}>{percentOfTotal}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Análise de Tipos de Despesas</Text>
      {renderForGroup(elected, 'Eleitos')}
      {renderForGroup(notElected, 'Não Eleitos')}
    </View>
  );
};

// Expense Champions Section - split by elected/not elected, no multi-category leaders
const ExpenseChampionsSection: React.FC<{ candidacies: Candidacy[] }> = ({ candidacies }) => {
  const elected = candidacies.filter(c => c.elected);
  const notElected = candidacies.filter(c => !c.elected);

  const renderChampions = (group: Candidacy[], groupLabel: string) => {
    if (group.length === 0) return null;

    const champions = LEGAL_EXPENSE_CATEGORIES.map(category => {
      const sorted = [...group].sort((a, b) => (b.expenses[category] || 0) - (a.expenses[category] || 0));
      const champion = sorted[0];
      const championValue = champion?.expenses[category] || 0;
      const totalCategory = group.reduce((sum, c) => sum + (c.expenses[category] || 0), 0);
      
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

    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.subsectionTitle}>{groupLabel}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Categoria</Text>
            <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Campeão</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Partido</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>Valor</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>% Cat.</Text>
          </View>
          {top15Champions.map((item, idx) => (
            <View key={item.category} style={[styles.tableRow, ...(idx % 2 === 1 ? [styles.tableRowAlt] : [])]}>
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
      </View>
    );
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Campeões de Gastos por Categoria</Text>
      {renderChampions(elected, 'Eleitos')}
      {renderChampions(notElected, 'Não Eleitos')}
    </View>
  );
};

// Analytical Groups Section - split by elected/not elected
const AnalyticalGroupsSection: React.FC<{ 
  candidacies: Candidacy[]; 
  groups: AnalyticalGroup[];
}> = ({ candidacies, groups }) => {
  if (groups.length === 0) return null;

  const elected = candidacies.filter(c => c.elected);
  const notElected = candidacies.filter(c => !c.elected);

  const renderForGroup = (cands: Candidacy[], label: string) => {
    if (cands.length === 0) return null;

    const groupData = groups.map(group => {
      const total = cands.reduce((sum, c) => {
        return sum + group.categories.reduce((catSum, cat) => catSum + (c.expenses[cat] || 0), 0);
      }, 0);
      return { name: group.name, total, color: group.color, categories: group.categories };
    }).sort((a, b) => b.total - a.total);

    const grandTotal = groupData.reduce((sum, g) => sum + g.total, 0);

    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.subsectionTitle}>{label} ({formatNumber(cands.length, 0)} candidaturas)</Text>

        <BarChartPDF 
          title={`Gastos por Grupo - ${label}`}
          data={groupData.map(g => ({
            label: g.name.length > 20 ? g.name.substring(0, 20) + '...' : g.name,
            value: g.total,
            color: g.color,
          }))}
          formatValue={formatCurrency}
        />

        <View style={[styles.chartContainer, { marginTop: 12 }]}>
          <Text style={styles.chartTitle}>Detalhamento - {label}</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Grupo</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Total</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>% do Total</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Categorias</Text>
          </View>
          {groupData.map((g, idx) => (
            <View key={g.name} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>{g.name}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(g.total)}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                {grandTotal > 0 ? ((g.total / grandTotal) * 100).toFixed(1) + '%' : '0%'}
              </Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>{String(g.categories.length)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Análise por Grupos Analíticos</Text>
      
      <View style={styles.statsGrid}>
        <StatCard label="Grupos Configurados" value={String(groups.length)} />
      </View>

      {renderForGroup(elected, 'Eleitos')}
      {renderForGroup(notElected, 'Não Eleitos')}
    </View>
  );
};

// Main Report Document
export const CampaignReport: React.FC<ReportProps> = ({
  dataset,
  sections,
  selectedCandidacies = [],
  analyticalGroups = [],
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
          <PageHeader title="Rankings" datasetName={dataset.name} />
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

      {/* Analytical Groups Page */}
      {sections.analyticalGroups && analyticalGroups.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader title="Grupos Analíticos" datasetName={dataset.name} />
          <AnalyticalGroupsSection candidacies={candidacies} groups={analyticalGroups} />
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

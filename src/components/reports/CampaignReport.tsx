import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { styles, colors } from './PDFStyles';
import { Candidacy, Dataset, LEGAL_EXPENSE_CATEGORIES } from '@/types/campaign';
import { formatCurrency, formatNumber, calculateMedian } from '@/lib/dataParser';

export interface ReportSections {
  summary: boolean;
  rankings: boolean;
  comparison: boolean;
  distributions: boolean;
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

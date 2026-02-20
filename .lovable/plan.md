
# Corrigir calculo de gastos totais: usar soma das categorias como fallback

## Problema identificado

O CSV importado tem as colunas "Despesas Financeiras" e "Doações Estimadas" zeradas para 8.352 candidaturas (29% dos dados), mesmo quando as 38 categorias de despesa detalhadas possuem valores reais. Como o sistema calcula `totalExpenses = financialExpenses + estimatedDonations`, essas candidaturas aparecem com R$ 0,00 de gastos e custo/voto = 0.

Exemplo: **Dani Portela (PSOL/PE)** tem R$ 459.612 em categorias detalhadas, mas aparece com gastos totais = R$ 0,00.

## Solucao

Adicionar um fallback: quando `financialExpenses + estimatedDonations = 0` mas a soma das categorias e maior que zero, usar a soma das categorias como `totalExpenses`.

## Alteracoes

### 1. Edge Function `import-csv/index.ts`

Nas funcoes `parseRowSingle` e `parseRowMulti`, apos calcular as categorias de despesa:

```text
// Atual:
const totalExpenses = financialExpenses + estimatedDonations;

// Novo:
const categoryTotal = Object.values(expenses).reduce((sum, v) => sum + v, 0);
const totalExpenses = (financialExpenses + estimatedDonations) > 0
  ? financialExpenses + estimatedDonations
  : categoryTotal;
```

Isso garante que importacoes futuras calculem corretamente.

### 2. Parser local `src/lib/dataParser.ts`

Aplicar a mesma logica de fallback na funcao `parseSpreadsheetData` para manter consistencia com o metodo de copia/cola.

### 3. Corrigir dados existentes no banco

Executar uma migracao SQL que recalcula `total_expenses` e `cost_per_vote` para todas as candidaturas afetadas:

```sql
UPDATE candidatures
SET
  total_expenses = (
    SELECT COALESCE(SUM(value::numeric), 0)
    FROM jsonb_each_text(expenses)
  ),
  cost_per_vote = CASE
    WHEN votes > 0 THEN (
      SELECT COALESCE(SUM(value::numeric), 0)
      FROM jsonb_each_text(expenses)
    ) / votes
    ELSE 0
  END
WHERE total_expenses = 0
  AND (
    SELECT COALESCE(SUM(value::numeric), 0)
    FROM jsonb_each_text(expenses)
  ) > 0;
```

Tambem atualizar os metadados dos datasets afetados (campo `total_expenses`).

### 4. Atualizar metadados dos datasets

```sql
UPDATE datasets d
SET total_expenses = (
  SELECT COALESCE(SUM(c.total_expenses), 0)
  FROM candidatures c
  WHERE c.dataset_id = d.id
);
```

## Secao tecnica

- **Arquivos modificados**: `supabase/functions/import-csv/index.ts`, `src/lib/dataParser.ts`
- **Migracao SQL**: 2 queries UPDATE para corrigir dados historicos
- **Impacto**: 8.352 candidaturas terao seus gastos corrigidos imediatamente; importacoes futuras usarao o fallback automaticamente
- **Risco**: Nenhum - o fallback so atua quando as colunas resumo sao zero, preservando dados corretos

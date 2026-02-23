

# Rastreamento de Lote de Importacao (Import Batch)

## Objetivo
Permitir identificar quais datasets foram importados a partir de um mesmo arquivo, adicionando um campo `import_batch_id` que agrupa datasets do mesmo lote.

## Mudancas

### 1. Banco de dados
- Adicionar coluna `import_batch_id` (uuid, nullable) na tabela `datasets`
  - Nullable porque datasets antigos nao terao esse campo, e datasets criados via copia/cola tambem nao precisam dele

### 2. Edge Function `import-csv`
- Gerar um UUID no inicio do processamento do arquivo
- Passar esse `import_batch_id` ao criar cada dataset (tanto no modo single quanto no multi-dataset)

### 3. Frontend - `DatasetManager.tsx`
- Agrupar visualmente datasets que compartilham o mesmo `import_batch_id`
- Exibir um indicador sutil (ex: badge ou label) mostrando quantos datasets fazem parte do mesmo lote

### 4. Tipos e hooks
- Atualizar o tipo `Dataset` em `src/types/campaign.ts` para incluir `importBatchId?: string`
- Atualizar `useDatasets.ts` para mapear o novo campo do banco

---

## Detalhes Tecnicos

### Migracao SQL
```sql
ALTER TABLE public.datasets
ADD COLUMN import_batch_id uuid DEFAULT NULL;
```

### Edge Function (import-csv)
- No inicio do handler, gerar `const batchId = crypto.randomUUID()`
- Incluir `import_batch_id: batchId` em todos os INSERTs de datasets

### DatasetManager
- Agrupar datasets por `import_batch_id` quando nao nulo
- Datasets sem `import_batch_id` aparecem individualmente
- Cada grupo exibe o numero de datasets do lote como badge no card

### Paste Tab (DataImport.tsx)
- Nao gera `import_batch_id` (importacao avulsa, sem arquivo)


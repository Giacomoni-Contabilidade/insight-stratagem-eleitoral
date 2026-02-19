

## Upload de CSV direto para o banco via Edge Function

### Problema atual
O fluxo atual exige colar dados no navegador, que faz parse em memória e insere via SDK do cliente. Para datasets grandes (1GB+), isso trava o browser e excede limites de request.

### Solucao proposta
Criar uma edge function `import-csv` que:
1. Recebe o CSV via upload (multipart/form-data) junto com metadados (nome, ano, estado, cargo)
2. Faz parse do CSV linha a linha no servidor (Deno)
3. Insere em lotes de 500 registros diretamente no banco usando service_role key (bypassa RLS)
4. Retorna progresso e resultado final

### Fluxo do usuario

```text
+------------------+     POST multipart      +------------------+
|   Browser        | ----------------------> |  Edge Function   |
|   (arquivo CSV)  |                         |  import-csv      |
+------------------+                         +--------+---------+
                                                      |
                                              Parse CSV em stream
                                              Insert batches de 500
                                                      |
                                              +-------v--------+
                                              |   Database     |
                                              |   datasets +   |
                                              |   candidatures |
                                              +----------------+
```

### Mudancas necessarias

#### 1. Nova Edge Function: `supabase/functions/import-csv/index.ts`
- Aceita POST com `multipart/form-data`
- Campos: `file` (CSV), `name`, `year`, `state`, `position`
- Valida autenticacao via token JWT no header Authorization
- Faz parse do CSV (separador tab ou virgula, com deteccao automatica)
- Reutiliza a logica de normalizacao (gender, race, education, parseNumber) do `dataParser.ts`, reescrita em Deno
- Cria o dataset com `user_id` do usuario autenticado
- Insere candidaturas em batches de 500
- Em caso de erro, faz rollback (deleta dataset incompleto)
- Retorna JSON com `{ datasetId, imported: number, errors: number }`

#### 2. Atualizar `supabase/config.toml`
- Adicionar configuracao `[functions.import-csv]` com `verify_jwt = false` (validacao manual no codigo)

#### 3. Atualizar UI: `src/components/DataImport.tsx`
- Adicionar aba/opcao "Upload de arquivo CSV" alem do paste atual
- Input de arquivo (`<input type="file" accept=".csv,.tsv,.txt">`)
- Ao selecionar arquivo, pula direto para a tela de "Configurar dataset" (nome, ano, estado, cargo)
- No submit, envia o arquivo via `fetch` para a edge function com o token do usuario
- Mostra barra de progresso (ou spinner) durante o upload
- Limite maximo de arquivo no frontend: avisar que arquivos muito grandes podem demorar

#### 4. Limite de tamanho
- Edge functions tem limite de ~100MB por request no plano Business
- Para arquivos maiores que ~100MB, sera necessario dividir o CSV antes do upload
- O frontend avisara o usuario sobre essa limitacao

### Detalhes tecnicos

**Parse no servidor (Deno):**
- Leitura do body como texto completo (para arquivos ate ~100MB)
- Split por linhas, deteccao de header, parse de cada coluna
- Mesma logica de normalizacao do `dataParser.ts` portada para Deno

**Insercao em lotes:**
- Cria o dataset primeiro
- Insere candidaturas em chunks de 500 com `supabase.from('candidatures').insert(batch)`
- Usa service_role key para bypass de RLS (mais rapido e evita problemas de permissao durante batch)
- Valida que o usuario esta autenticado antes de prosseguir

**Tratamento de erros:**
- Se qualquer batch falhar, deleta o dataset (rollback)
- Retorna contagem de linhas importadas vs linhas com erro


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Normalization helpers (ported from dataParser.ts) ──

const LEGAL_EXPENSE_CATEGORIES = [
  "Água","Alimentação","Aquisição/Doação de bens móveis ou imóveis",
  "Atividades de militância e mobilização de rua","Cessão ou locação de veículos",
  "Combustíveis e lubrificantes","Comícios","Correspondências e despesas postais",
  "Criação e inclusão de páginas na internet","Despesa com Impulsionamento de Conteúdos",
  "Despesas com Hospedagem","Despesas com pessoal","Despesas com transporte ou deslocamento",
  "Diversas a especificar","Doações financeiras a outros candidatos/partidos",
  "Encargos financeiros, taxas bancárias e/ou operações com cartão de crédito",
  "Encargos sociais","Energia elétrica","Eventos de promoção da candidatura",
  "Impostos, contribuições e taxas","Locação/cessão de bens imóveis",
  "Locação/cessão de bens móveis (exceto veículos)","Materiais de expediente",
  "Pesquisas ou testes eleitorais","Pré-instalação física de comitê de campanha",
  "Produção de jingles, vinhetas e slogans",
  "Produção de programas de rádio, televisão ou vídeo","Publicidade por adesivos",
  "Publicidade por carros de som","Publicidade por jornais e revistas",
  "Publicidade por materiais impressos","Reembolsos de gastos realizados por eleitores",
  "Serviços advocatícios","Serviços contábeis","Serviços prestados por terceiros",
  "Serviços próprios prestados por terceiros",
  "Taxa de Administração de Financiamento Coletivo","Telefone",
] as const;

const SINGLE_EXPECTED_COLUMNS = 10 + LEGAL_EXPENSE_CATEGORIES.length; // 48
// Multi format: Candidatura, Cargo, Partido, UF, Municipio, Genero, Raça_cor, Ensino, Ocupacao, Votos, Despesas_Financeiras, Doacoes_Estimadas, Total de gastos, [38 expense categories]
const MULTI_EXPECTED_COLUMNS = 13 + LEGAL_EXPENSE_CATEGORIES.length + 1; // 52 (last column = Eleito)

function normalizeGender(v: string): string {
  const n = v.toLowerCase().trim();
  if (n.includes("masc") || n === "m") return "Masculino";
  if (n.includes("fem") || n === "f") return "Feminino";
  return "Não informado";
}

function normalizeRace(v: string): string {
  const n = v.toLowerCase().trim();
  if (n.includes("branc")) return "Branca";
  if (n.includes("pret")) return "Preta";
  if (n.includes("pard")) return "Parda";
  if (n.includes("amarel")) return "Amarela";
  if (n.includes("indíg") || n.includes("indig")) return "Indígena";
  return "Não informado";
}

function normalizeEducation(v: string): string {
  const n = v.toLowerCase().trim();
  if (n.includes("pós") || n.includes("pos") || n.includes("mestrado") || n.includes("doutorado"))
    return "Pós-graduação";
  if (n.includes("superior") && n.includes("complet")) return "Superior completo";
  if (n.includes("superior") && n.includes("incomplet")) return "Superior incompleto";
  if ((n.includes("médio") || n.includes("medio")) && n.includes("complet")) return "Médio completo";
  if ((n.includes("médio") || n.includes("medio")) && n.includes("incomplet")) return "Médio incompleto";
  if (n.includes("fundamental") && n.includes("complet")) return "Fundamental completo";
  if (n.includes("fundamental") && n.includes("incomplet")) return "Fundamental incompleto";
  return "Não informado";
}

function normalizePosition(v: string): string {
  const n = v.toLowerCase().trim();
  if (n.includes("dep") && n.includes("est")) return "Deputado Estadual";
  if (n.includes("dep") && n.includes("fed")) return "Deputado Federal";
  if (n.includes("vereador")) return "Vereador";
  if (n.includes("prefeito") && !n.includes("vice")) return "Prefeito";
  if (n.includes("vice") && n.includes("prefeito")) return "Vice-Prefeito";
  if (n.includes("governador") && !n.includes("vice")) return "Governador";
  if (n.includes("vice") && n.includes("governador")) return "Vice-Governador";
  if (n.includes("senador")) return "Senador";
  if (n.includes("presidente") && !n.includes("vice")) return "Presidente";
  if (n.includes("vice") && n.includes("presidente")) return "Vice-Presidente";
  // Return as-is with title case if no match
  return v.trim();
}

function parseNumber(value: string): number {
  if (!value || value.trim() === "") return 0;
  const trimmed = value.trim();
  const isAccountingNegative = /^\(.*\)$/.test(trimmed);
  let cleaned = trimmed.replace(/[^0-9,.\-]/g, "");
  if (!cleaned) return 0;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount > 1) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(",", ".");
    }
  } else if (lastDot !== -1) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      cleaned = cleaned.replace(/\./g, "");
    } else {
      const parts = cleaned.split(".");
      const afterDot = parts[1];
      if (afterDot && afterDot.length === 3 && /^\d{3}$/.test(afterDot) && parts[0].length >= 1) {
        cleaned = cleaned.replace(".", "");
      }
    }
  }

  let num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (isAccountingNegative) num = -Math.abs(num);
  return num;
}

// ── Detect separator (tab vs comma vs semicolon) ──

function detectSeparator(firstLine: string): string {
  if (firstLine.includes("\t")) return "\t";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

// ── CSV-aware split: handles quoted fields with commas ──

function splitCSVLine(line: string, separator: string): string[] {
  if (separator === "\t") return line.split("\t");
  
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Parse a single CSV row (SINGLE mode) ──

function parseRowSingle(columns: string[], datasetId: string) {
  const errors: string[] = [];

  if (columns.length < SINGLE_EXPECTED_COLUMNS) {
    errors.push(`Colunas insuficientes: ${columns.length}/${SINGLE_EXPECTED_COLUMNS}`);
  }

  const name = columns[0]?.trim() || "";
  const party = columns[1]?.trim() || "";
  if (!name) errors.push("Nome obrigatório");
  if (!party) errors.push("Partido obrigatório");

  const gender = normalizeGender(columns[2] || "");
  const race = normalizeRace(columns[3] || "");
  const education = normalizeEducation(columns[4] || "");
  const occupation = columns[5]?.trim() || "Não informado";
  const votes = parseNumber(columns[6] || "0");
  const financialExpenses = parseNumber(columns[7] || "0");
  const estimatedDonations = parseNumber(columns[8] || "0");

  if (votes < 0) errors.push("Votos negativo");

  const expenses: Record<string, number> = {};
  for (let i = 0; i < LEGAL_EXPENSE_CATEGORIES.length; i++) {
    expenses[LEGAL_EXPENSE_CATEGORIES[i]] = parseNumber(columns[10 + i] || "0");
  }

  const categoryTotal = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  const totalExpenses = categoryTotal;
  const costPerVote = votes > 0 ? totalExpenses / votes : 0;

  return {
    errors,
    record: {
      dataset_id: datasetId,
      name,
      party,
      gender,
      race,
      education,
      occupation,
      votes,
      financial_expenses: financialExpenses,
      estimated_donations: estimatedDonations,
      total_expenses: totalExpenses,
      cost_per_vote: costPerVote,
      expenses,
    },
  };
}

// ── Parse a single CSV row (MULTI mode) ──
// Columns: Candidatura(0), Cargo(1), Partido(2), UF(3), Municipio(4), Genero(5), Raça_cor(6), Ensino(7), Ocupacao(8), Votos(9), Despesas_Financeiras(10), Doacoes_Estimadas(11), Total de gastos(12), [expense categories 13+]

function parseRowMulti(columns: string[]) {
  const errors: string[] = [];

  const name = columns[0]?.trim() || "";
  const position = columns[1]?.trim() || "";
  const party = columns[2]?.trim() || "";
  const state = columns[3]?.trim().toUpperCase() || "";
  // columns[4] = Municipio (used as info but not for grouping)
  const gender = normalizeGender(columns[5] || "");
  const race = normalizeRace(columns[6] || "");
  const education = normalizeEducation(columns[7] || "");
  const occupation = columns[8]?.trim() || "Não informado";
  const votes = parseNumber(columns[9] || "0");
  const financialExpenses = parseNumber(columns[10] || "0");
  const estimatedDonations = parseNumber(columns[11] || "0");
  // columns[12] = Total de gastos (we recalculate)

  if (!name) errors.push("Nome obrigatório");
  if (!party) errors.push("Partido obrigatório");
  if (!position) errors.push("Cargo obrigatório");
  if (!state) errors.push("UF obrigatória");
  if (votes < 0) errors.push("Votos negativo");

  const expenses: Record<string, number> = {};
  for (let i = 0; i < LEGAL_EXPENSE_CATEGORIES.length; i++) {
    expenses[LEGAL_EXPENSE_CATEGORIES[i]] = parseNumber(columns[13 + i] || "0");
  }

  const categoryTotal = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  const totalExpenses = categoryTotal;
  const costPerVote = votes > 0 ? totalExpenses / votes : 0;

  // Last column: Eleito (boolean)
  const eleitoCol = columns[13 + LEGAL_EXPENSE_CATEGORIES.length]?.trim().toLowerCase() || "";
  const elected = eleitoCol === "true" || eleitoCol === "1" || eleitoCol === "sim" || eleitoCol === "s" || eleitoCol === "eleito";

  return {
    errors,
    position: normalizePosition(position),
    state,
    record: {
      name,
      party,
      gender,
      race,
      education,
      occupation,
      votes,
      financial_expenses: financialExpenses,
      estimated_donations: estimatedDonations,
      total_expenses: totalExpenses,
      cost_per_vote: costPerVote,
      expenses,
      elected,
    },
  };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Service-role client for bypassing RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "single";
    const name = (formData.get("name") as string) || "";
    const year = parseInt((formData.get("year") as string) || "0", 10);

    if (!file || !name || !year) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: file, name, year" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read file text
    const text = await file.text();
    const lines = text.trim().split("\n");
    if (lines.length === 0) {
      return new Response(JSON.stringify({ error: "Arquivo vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect separator & skip header
    const separator = detectSeparator(lines[0]);
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes("candidatura") || firstLine.includes("partido");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Generate a batch ID to group datasets from the same file
    const batchId = crypto.randomUUID();

    if (mode === "multi") {
      return await handleMultiMode(supabase, dataLines, separator, name, year, userId, batchId);
    } else {
      // Single mode needs state + position
      const state = (formData.get("state") as string) || "";
      const position = (formData.get("position") as string) || "";
      if (!state || !position) {
        return new Response(
          JSON.stringify({ error: "Campos obrigatórios para modo single: state, position" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return await handleSingleMode(supabase, dataLines, separator, name, year, state, position, userId, batchId);
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Single mode handler ──

async function handleSingleMode(
  supabase: ReturnType<typeof createClient>,
  dataLines: string[],
  separator: string,
  name: string,
  year: number,
  state: string,
  position: string,
  userId: string,
  batchId: string
) {
  const { data: dataset, error: dsError } = await supabase
    .from("datasets")
    .insert({ name, year, state, position, user_id: userId, import_batch_id: batchId })
    .select("id")
    .single();

  if (dsError || !dataset) {
    return new Response(
      JSON.stringify({ error: "Erro ao criar dataset", details: dsError?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const datasetId = dataset.id;
  let imported = 0;
  let errorCount = 0;
  const BATCH_SIZE = 2000;
  let batch: Record<string, unknown>[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const columns = splitCSVLine(line, separator);
    const { errors, record } = parseRowSingle(columns, datasetId);

    if (errors.length > 0) {
      errorCount++;
      continue;
    }

    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      const { error: insertError } = await supabase.from("candidatures").insert(batch);
      if (insertError) {
        await supabase.from("candidatures").delete().eq("dataset_id", datasetId);
        await supabase.from("datasets").delete().eq("id", datasetId);
        return new Response(
          JSON.stringify({ error: "Erro ao inserir candidaturas", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      imported += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const { error: insertError } = await supabase.from("candidatures").insert(batch);
    if (insertError) {
      await supabase.from("candidatures").delete().eq("dataset_id", datasetId);
      await supabase.from("datasets").delete().eq("id", datasetId);
      return new Response(
        JSON.stringify({ error: "Erro ao inserir candidaturas", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    imported += batch.length;
  }

  // Compute and store dataset metadata from in-memory records
  const allRecords = dataLines
    .filter(l => l.trim())
    .map(l => parseRowSingle(splitCSVLine(l, separator), datasetId))
    .filter(r => r.errors.length === 0)
    .map(r => r.record);
  const totalVotes = allRecords.reduce((s, r) => s + (Number(r.votes) || 0), 0);
  const totalExpenses = allRecords.reduce((s, r) => s + (Number(r.total_expenses) || 0), 0);
  await supabase.from("datasets").update({
    candidacy_count: imported,
    total_votes: totalVotes,
    total_expenses: totalExpenses,
  }).eq("id", datasetId);

  return new Response(
    JSON.stringify({ datasetId, imported, errors: errorCount }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Multi mode handler: groups by Cargo+UF, creates multiple datasets ──

async function handleMultiMode(
  supabase: ReturnType<typeof createClient>,
  dataLines: string[],
  separator: string,
  namePrefix: string,
  year: number,
  userId: string,
  batchId: string
) {
  // Positions to skip (they don't run independently)
  const SKIP_POSITIONS = ["Vice-Governador", "Vice-Prefeito", "Vice-Presidente"];

  // Group rows by position+state
  const groups = new Map<string, { position: string; state: string; records: Record<string, unknown>[] }>();
  let errorCount = 0;
  let skippedVice = 0;

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const columns = splitCSVLine(line, separator);
    const { errors, position, state, record } = parseRowMulti(columns);

    if (errors.length > 0) {
      errorCount++;
      continue;
    }

    // Skip vice positions — they don't have independent candidacies
    if (SKIP_POSITIONS.includes(position)) {
      skippedVice++;
      continue;
    }

    const key = `${position}|||${state}`;
    if (!groups.has(key)) {
      groups.set(key, { position, state, records: [] });
    }
    groups.get(key)!.records.push(record);
  }

  if (groups.size === 0) {
    return new Response(
      JSON.stringify({ error: "Nenhuma linha válida encontrada" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create datasets and insert candidatures
  const createdDatasets: { datasetId: string; position: string; state: string; imported: number }[] = [];
  const BATCH_SIZE = 2000;

  for (const [, group] of groups) {
    const datasetName = `${namePrefix} - ${group.position} - ${group.state}`;

    const { data: dataset, error: dsError } = await supabase
      .from("datasets")
      .insert({ name: datasetName, year, state: group.state, position: group.position, user_id: userId, import_batch_id: batchId })
      .select("id")
      .single();

    if (dsError || !dataset) {
      // Rollback all previously created datasets
      for (const created of createdDatasets) {
        await supabase.from("candidatures").delete().eq("dataset_id", created.datasetId);
        await supabase.from("datasets").delete().eq("id", created.datasetId);
      }
      return new Response(
        JSON.stringify({ error: "Erro ao criar dataset", details: dsError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const datasetId = dataset.id;
    let imported = 0;

    // Add dataset_id to each record
    const recordsWithId = group.records.map((r) => ({ ...r, dataset_id: datasetId }));

    // Insert in batches
    for (let i = 0; i < recordsWithId.length; i += BATCH_SIZE) {
      const batch = recordsWithId.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("candidatures").insert(batch);
      if (insertError) {
        // Rollback everything
        for (const created of createdDatasets) {
          await supabase.from("candidatures").delete().eq("dataset_id", created.datasetId);
          await supabase.from("datasets").delete().eq("id", created.datasetId);
        }
        await supabase.from("candidatures").delete().eq("dataset_id", datasetId);
        await supabase.from("datasets").delete().eq("id", datasetId);
        return new Response(
          JSON.stringify({ error: "Erro ao inserir candidaturas", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      imported += batch.length;
    }

    // Compute and store dataset metadata
    const totalVotes = group.records.reduce((s, r) => s + (Number(r.votes) || 0), 0);
    const totalExpenses = group.records.reduce((s, r) => s + (Number(r.total_expenses) || 0), 0);
    await supabase.from("datasets").update({
      candidacy_count: imported,
      total_votes: totalVotes,
      total_expenses: totalExpenses,
    }).eq("id", datasetId);

    createdDatasets.push({ datasetId, position: group.position, state: group.state, imported });
  }

  const totalImported = createdDatasets.reduce((sum, d) => sum + d.imported, 0);

  return new Response(
    JSON.stringify({
      datasets: createdDatasets,
      totalDatasets: createdDatasets.length,
      totalImported,
      errors: errorCount,
      skippedVice,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

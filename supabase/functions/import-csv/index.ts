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

const EXPECTED_COLUMNS = 10 + LEGAL_EXPENSE_CATEGORIES.length; // 48

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

// ── Parse a single CSV row into a candidature insert object ──

function parseRow(columns: string[], datasetId: string) {
  const errors: string[] = [];

  if (columns.length < EXPECTED_COLUMNS) {
    errors.push(`Colunas insuficientes: ${columns.length}/${EXPECTED_COLUMNS}`);
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

  const totalExpenses = financialExpenses + estimatedDonations;
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
    const name = (formData.get("name") as string) || "";
    const year = parseInt((formData.get("year") as string) || "0", 10);
    const state = (formData.get("state") as string) || "";
    const position = (formData.get("position") as string) || "";

    if (!file || !name || !year || !state || !position) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: file, name, year, state, position" }),
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

    // Create dataset
    const { data: dataset, error: dsError } = await supabase
      .from("datasets")
      .insert({ name, year, state, position, user_id: userId })
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
    const BATCH_SIZE = 500;
    let batch: Record<string, unknown>[] = [];

    for (const line of dataLines) {
      if (!line.trim()) continue;
      const columns = line.split(separator);
      const { errors, record } = parseRow(columns, datasetId);

      if (errors.length > 0) {
        errorCount++;
        continue;
      }

      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        const { error: insertError } = await supabase.from("candidatures").insert(batch);
        if (insertError) {
          // Rollback: delete dataset
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

    // Flush remaining
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

    return new Response(
      JSON.stringify({ datasetId, imported, errors: errorCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

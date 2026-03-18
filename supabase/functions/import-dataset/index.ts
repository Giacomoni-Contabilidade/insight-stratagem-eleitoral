import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// ── Types ──

interface CandidatureInput {
  nome: string;
  partido: string;
  genero?: string;
  raca?: string;
  escolaridade?: string;
  ocupacao?: string;
  votos?: number;
  despesas_financeiras?: number;
  doacoes_estimadas?: number;
  agua?: number;
  alimentacao?: number;
  aquisicao_doacao_bens?: number;
  militancia_mobilizacao?: number;
  cessao_locacao_veiculos?: number;
  combustiveis?: number;
  comicios?: number;
  correspondencias?: number;
  paginas_internet?: number;
  impulsionamento?: number;
  hospedagem?: number;
  pessoal?: number;
  transporte?: number;
  diversas?: number;
  doacoes_financeiras?: number;
  encargos_financeiros?: number;
  encargos_sociais?: number;
  energia_eletrica?: number;
  eventos_promocao?: number;
  impostos?: number;
  locacao_imoveis?: number;
  locacao_moveis?: number;
  materiais_expediente?: number;
  pesquisas_testes?: number;
  pre_instalacao_comite?: number;
  jingles_vinhetas?: number;
  programas_radio_tv?: number;
  adesivos?: number;
  carros_som?: number;
  jornais_revistas?: number;
  materiais_impressos?: number;
  reembolsos?: number;
  servicos_advocaticios?: number;
  servicos_contabeis?: number;
  servicos_terceiros?: number;
  servicos_proprios_terceiros?: number;
  taxa_financiamento_coletivo?: number;
  telefone?: number;
  eleito?: boolean;
}

interface ImportRequest {
  dataset_id?: string; // If provided, appends to existing dataset
  name?: string;
  year?: number;
  state?: string;
  position?: string;
  candidaturas: CandidatureInput[];
}

// Map short keys to legal expense categories
const EXPENSE_KEY_MAP: Record<string, string> = {
  agua: "Água",
  alimentacao: "Alimentação",
  aquisicao_doacao_bens: "Aquisição/Doação de bens móveis ou imóveis",
  militancia_mobilizacao: "Atividades de militância e mobilização de rua",
  cessao_locacao_veiculos: "Cessão ou locação de veículos",
  combustiveis: "Combustíveis e lubrificantes",
  comicios: "Comícios",
  correspondencias: "Correspondências e despesas postais",
  paginas_internet: "Criação e inclusão de páginas na internet",
  impulsionamento: "Despesa com Impulsionamento de Conteúdos",
  hospedagem: "Despesas com Hospedagem",
  pessoal: "Despesas com pessoal",
  transporte: "Despesas com transporte ou deslocamento",
  diversas: "Diversas a especificar",
  doacoes_financeiras: "Doações financeiras a outros candidatos/partidos",
  encargos_financeiros: "Encargos financeiros, taxas bancárias e/ou operações com cartão de crédito",
  encargos_sociais: "Encargos sociais",
  energia_eletrica: "Energia elétrica",
  eventos_promocao: "Eventos de promoção da candidatura",
  impostos: "Impostos, contribuições e taxas",
  locacao_imoveis: "Locação/cessão de bens imóveis",
  locacao_moveis: "Locação/cessão de bens móveis (exceto veículos)",
  materiais_expediente: "Materiais de expediente",
  pesquisas_testes: "Pesquisas ou testes eleitorais",
  pre_instalacao_comite: "Pré-instalação física de comitê de campanha",
  jingles_vinhetas: "Produção de jingles, vinhetas e slogans",
  programas_radio_tv: "Produção de programas de rádio, televisão ou vídeo",
  adesivos: "Publicidade por adesivos",
  carros_som: "Publicidade por carros de som",
  jornais_revistas: "Publicidade por jornais e revistas",
  materiais_impressos: "Publicidade por materiais impressos",
  reembolsos: "Reembolsos de gastos realizados por eleitores",
  servicos_advocaticios: "Serviços advocatícios",
  servicos_contabeis: "Serviços contábeis",
  servicos_terceiros: "Serviços prestados por terceiros",
  servicos_proprios_terceiros: "Serviços próprios prestados por terceiros",
  taxa_financiamento_coletivo: "Taxa de Administração de Financiamento Coletivo",
  telefone: "Telefone",
};

function processCandidature(c: CandidatureInput, datasetId: string) {
  const expenses: Record<string, number> = {};
  for (const category of LEGAL_EXPENSE_CATEGORIES) {
    expenses[category] = 0;
  }

  // Map input keys to expense categories
  for (const [key, category] of Object.entries(EXPENSE_KEY_MAP)) {
    const value = (c as Record<string, unknown>)[key];
    if (typeof value === "number") {
      expenses[category] = value;
    }
  }

  const totalExpenses = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  const votes = c.votos ?? 0;
  const costPerVote = votes > 0 ? totalExpenses / votes : 0;

  return {
    dataset_id: datasetId,
    name: c.nome.trim(),
    party: c.partido.trim(),
    gender: normalizeGender(c.genero || ""),
    race: normalizeRace(c.raca || ""),
    education: normalizeEducation(c.escolaridade || ""),
    occupation: (c.ocupacao || "Não informado").trim(),
    votes,
    financial_expenses: c.despesas_financeiras ?? 0,
    estimated_donations: c.doacoes_estimadas ?? 0,
    total_expenses: totalExpenses,
    cost_per_vote: costPerVote,
    expenses,
    elected: c.eleito ?? false,
  };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
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

    // Service-role client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse JSON body
    const body: ImportRequest = await req.json();

    if (!body.candidaturas || !Array.isArray(body.candidaturas) || body.candidaturas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Array 'candidaturas' é obrigatório e não pode ser vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each candidature has nome + partido
    for (let i = 0; i < body.candidaturas.length; i++) {
      const c = body.candidaturas[i];
      if (!c.nome?.trim()) {
        return new Response(
          JSON.stringify({ error: `Candidatura ${i + 1}: 'nome' é obrigatório` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!c.partido?.trim()) {
        return new Response(
          JSON.stringify({ error: `Candidatura ${i + 1}: 'partido' é obrigatório` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let datasetId: string;
    let isAppend = false;

    if (body.dataset_id) {
      // Append mode: verify dataset exists and belongs to user
      const { data: existing, error: fetchError } = await supabase
        .from("datasets")
        .select("id, user_id")
        .eq("id", body.dataset_id)
        .single();

      if (fetchError || !existing) {
        return new Response(
          JSON.stringify({ error: "Dataset não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (existing.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para este dataset" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      datasetId = existing.id;
      isAppend = true;
    } else {
      // Create mode: require name, year, state, position
      if (!body.name || !body.year || !body.state || !body.position) {
        return new Response(
          JSON.stringify({ error: "Campos obrigatórios para novo dataset: name, year, state, position" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: dataset, error: dsError } = await supabase
        .from("datasets")
        .insert({
          name: body.name.trim(),
          year: body.year,
          state: body.state.trim().toUpperCase(),
          position: body.position.trim(),
          user_id: userId,
        })
        .select("id")
        .single();

      if (dsError || !dataset) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar dataset", details: dsError?.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      datasetId = dataset.id;
    }

    // Process and insert candidatures in batches
    const records = body.candidaturas.map(c => processCandidature(c, datasetId));
    const BATCH_SIZE = 500;
    let imported = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("candidatures").insert(batch);
      if (insertError) {
        // Rollback: remove inserted candidatures; if new dataset, remove it too
        await supabase.from("candidatures").delete().eq("dataset_id", datasetId);
        if (!isAppend) {
          await supabase.from("datasets").delete().eq("id", datasetId);
        }
        return new Response(
          JSON.stringify({ error: "Erro ao inserir candidaturas", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      imported += batch.length;
    }

    // Update dataset metadata (recalculate from all candidatures)
    const { data: allCandidatures } = await supabase
      .from("candidatures")
      .select("votes, total_expenses")
      .eq("dataset_id", datasetId);

    const totalVotes = (allCandidatures || []).reduce((s, r) => s + (Number(r.votes) || 0), 0);
    const totalExpenses = (allCandidatures || []).reduce((s, r) => s + (Number(r.total_expenses) || 0), 0);
    const candidacyCount = (allCandidatures || []).length;

    await supabase.from("datasets").update({
      candidacy_count: candidacyCount,
      total_votes: totalVotes,
      total_expenses: totalExpenses,
    }).eq("id", datasetId);

    return new Response(
      JSON.stringify({ datasetId, imported, candidacyCount, totalVotes, totalExpenses, appended: isAppend }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PopulationImportRecord {
  codigo_ibge: string;
  uf: string;
  municipality_name: string;
  population: number;
  reference_year: number;
  reference_date?: string | null;
  source: string;
}

interface PopulationImportRequest {
  records: PopulationImportRecord[];
}

const isValidIsoDate = (value: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const normalizeRecord = (record: PopulationImportRecord, index: number) => {
  const codigoIbge = String(record.codigo_ibge || "").trim();
  const uf = String(record.uf || "").trim().toUpperCase();
  const municipalityName = String(record.municipality_name || "").trim();
  const source = String(record.source || "").trim();
  const population = Number(record.population);
  const referenceYear = Number(record.reference_year);
  const referenceDate =
    record.reference_date === null || record.reference_date === undefined || record.reference_date === ""
      ? null
      : String(record.reference_date).trim();

  if (!/^\d{7}$/.test(codigoIbge)) {
    throw new Error(`Registro ${index + 1}: 'codigo_ibge' deve ter 7 dígitos`);
  }

  if (!/^[A-Z]{2}$/.test(uf)) {
    throw new Error(`Registro ${index + 1}: 'uf' deve ter 2 letras`);
  }

  if (!municipalityName) {
    throw new Error(`Registro ${index + 1}: 'municipality_name' é obrigatório`);
  }

  if (!Number.isInteger(population) || population < 0) {
    throw new Error(`Registro ${index + 1}: 'population' deve ser inteiro não negativo`);
  }

  if (!Number.isInteger(referenceYear) || referenceYear < 1900 || referenceYear > 2100) {
    throw new Error(`Registro ${index + 1}: 'reference_year' inválido`);
  }

  if (referenceDate && !isValidIsoDate(referenceDate)) {
    throw new Error(`Registro ${index + 1}: 'reference_date' deve estar em YYYY-MM-DD`);
  }

  if (!source) {
    throw new Error(`Registro ${index + 1}: 'source' é obrigatório`);
  }

  return {
    codigo_ibge: codigoIbge,
    uf,
    municipality_name: municipalityName,
    population,
    reference_year: referenceYear,
    reference_date: referenceDate,
    source,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = (await req.json()) as PopulationImportRequest;
    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return new Response(
        JSON.stringify({ error: "Array 'records' é obrigatório e não pode ser vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedRecords = body.records.map((record, index) => normalizeRecord(record, index));

    const { error: upsertError } = await supabase
      .from("ibge_municipal_populations")
      .upsert(normalizedRecords, { onConflict: "codigo_ibge,reference_year" });

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: "Erro ao importar populações do IBGE", details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ imported: normalizedRecords.length, errors: 0, total: normalizedRecords.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

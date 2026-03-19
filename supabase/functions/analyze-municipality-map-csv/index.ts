import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const PROCESSING_BATCH_STATES = new Set(["BATCH_STATE_PENDING", "BATCH_STATE_RUNNING"]);
const FINISHED_BATCH_STATES = new Set([
  "BATCH_STATE_SUCCEEDED",
  "BATCH_STATE_FAILED",
  "BATCH_STATE_CANCELLED",
  "BATCH_STATE_EXPIRED",
  "SYNC_COMPLETED",
]);

type AnalyzeMode = "sync" | "batch" | "sync_pending" | "chat";
type GeminiInputMode = "csv" | "dossier";

interface AnalyzeRequestBody {
  mode?: AnalyzeMode;
  hash?: string;
  chatId?: string;
  csvText?: string;
  dossierText?: string;
  candidateNames?: string[];
  model?: string;
  customPrompt?: string;
  inputMode?: GeminiInputMode;
  message?: string;
  stream?: boolean;
}

interface ChatRow {
  id: string;
  file_hash: string;
  candidate_scope: string[] | null;
  title: string;
  gemini_analysis: string | null;
  gemini_model: string | null;
  gemini_prompt: string | null;
  analysis_created_at: string | null;
  gemini_batch_name: string | null;
  gemini_batch_status: string | null;
  gemini_batch_requested_at: string | null;
  gemini_batch_updated_at: string | null;
  gemini_batch_completed_at: string | null;
  gemini_batch_error: string | null;
  gemini_input_mode: GeminiInputMode | null;
}

interface ChatMessageRow {
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at: string;
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

const normalizeCandidateNames = (candidateNames: string[] | undefined) =>
  [...new Set((candidateNames || []).map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const normalizeModel = (model: string | undefined) => model?.trim() || DEFAULT_GEMINI_MODEL;
const normalizePrompt = (prompt: string | undefined) => prompt?.trim() || null;
const normalizeInputMode = (inputMode: string | undefined): GeminiInputMode =>
  inputMode === "dossier" ? "dossier" : "csv";

const buildAnalysisPrompt = (
  inputMode: GeminiInputMode,
  csvText: string | null,
  dossierText: string | null,
  candidateNames: string[],
  customPrompt: string | null,
) => `
Voce e um analista politico e eleitoral.
Recebera ${inputMode === "dossier" ? "um dossie estruturado" : "um CSV bruto"} de votos por municipio.

Objetivo:
- resumir os achados mais relevantes de forma clara e util
- destacar concentracoes geograficas e distribuicao dos votos
- apontar municipios fortes e fracos quando isso estiver evidente
- citar anomalias ou limites da leitura quando perceber

Regras:
- responda em portugues do Brasil
- seja objetivo, mas com analise de valor
- produza no maximo 6 bullets curtos
- termine com 1 paragrafo curto de interpretacao geral
- nao invente dados ausentes

${candidateNames.length > 0 ? `Candidatos que devem ser considerados na analise:\n${candidateNames.join(", ")}\n` : ""}
${customPrompt ? `Instrucoes adicionais do usuario:\n${customPrompt}\n` : ""}
${inputMode === "dossier" ? "Dossie estruturado:" : "CSV:"}
${inputMode === "dossier" ? dossierText : csvText}
`.trim();

const buildChatPrompt = (
  analysis: string,
  history: ChatMessageRow[],
  userMessage: string,
  customPrompt: string | null,
) => `
Voce esta continuando uma conversa sobre uma analise eleitoral de um CSV municipal.
Responda em portugues do Brasil, de forma objetiva e util.

${customPrompt ? `Preferencias adicionais do usuario:\n${customPrompt}\n` : ""}
Analise-base:
${analysis}

Historico da conversa:
${history.map((message) => `${message.role === "user" ? "Usuario" : "Assistente"}: ${message.content}`).join("\n")}

Nova mensagem do usuario:
${userMessage}
`.trim();

const extractTextFromGenerateContent = (payload: any): string => {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("\n")
    .trim() || "";
};

const extractStreamTextFromGenerateContent = (payload: any): string => {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("") || "";
};

const extractBatchResource = (payload: any) => {
  if (payload?.response && typeof payload.response === "object") {
    return payload.response;
  }
  return payload;
};

const extractBatchName = (payload: any): string | null => {
  const batch = extractBatchResource(payload);
  if (typeof batch?.name === "string" && batch.name.startsWith("batches/")) {
    return batch.name;
  }
  if (typeof payload?.name === "string" && payload.name.startsWith("batches/")) {
    return payload.name;
  }
  return null;
};

const extractBatchState = (payload: any): string | null => {
  const batch = extractBatchResource(payload);
  return batch?.state || payload?.metadata?.state || null;
};

const extractBatchTimestamps = (payload: any) => {
  const batch = extractBatchResource(payload);
  return {
    requestedAt: batch?.createTime || payload?.metadata?.createTime || null,
    updatedAt: batch?.updateTime || payload?.metadata?.updateTime || null,
    completedAt: batch?.endTime || payload?.metadata?.endTime || null,
  };
};

const extractBatchError = (payload: any): string | null => {
  const batch = extractBatchResource(payload);
  return (
    payload?.error?.message ||
    batch?.error?.message ||
    batch?.output?.inlinedResponses?.inlinedResponses?.[0]?.error?.message ||
    null
  );
};

const extractAnalysisFromBatch = (payload: any): string => {
  const batch = extractBatchResource(payload);
  const firstResponse =
    batch?.output?.inlinedResponses?.inlinedResponses?.[0]?.response ||
    payload?.output?.inlinedResponses?.inlinedResponses?.[0]?.response;

  return extractTextFromGenerateContent(firstResponse);
};

const fetchGeminiJson = async (
  url: string,
  geminiApiKey: string,
  init?: RequestInit,
) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey,
      ...(init?.headers || {}),
    },
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json?.error?.message || "Falha ao processar a requisição no Gemini.");
  }

  return json;
};

const runGeminiText = async (
  geminiApiKey: string,
  model: string,
  prompt: string,
) => {
  const payload = await fetchGeminiJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    geminiApiKey,
    {
      method: "POST",
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    },
  );

  return extractTextFromGenerateContent(payload);
};

const streamGeminiText = async (
  geminiApiKey: string,
  model: string,
  prompt: string,
  onChunk: (chunk: string) => void,
) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Falha ao iniciar streaming no Gemini.");
  }

  if (!response.body) {
    throw new Error("O Gemini não retornou stream de resposta.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const dataText = trimmed.replace(/^data:\s*/, "");
      if (!dataText || dataText === "[DONE]") continue;

      const payload = JSON.parse(dataText);
      const chunk = extractStreamTextFromGenerateContent(payload);

      if (chunk) {
        fullText += chunk;
        onChunk(chunk);
      }
    }
  }

  return fullText.trim();
};

const selectChatRow = async (supabase: ReturnType<typeof createClient>, chatId: string) => {
  const { data, error } = await supabase
    .from("municipality_map_ai_chats")
    .select(
      "id, file_hash, title, candidate_scope, gemini_analysis, gemini_model, gemini_prompt, analysis_created_at, gemini_batch_name, gemini_batch_status, gemini_batch_requested_at, gemini_batch_updated_at, gemini_batch_completed_at, gemini_batch_error, gemini_input_mode",
    )
    .eq("id", chatId)
    .maybeSingle();

  if (error) throw error;
  return (data as ChatRow | null) || null;
};

const upsertHashRow = async (
  supabase: ReturnType<typeof createClient>,
  values: Record<string, unknown>,
) => {
  const { error } = await supabase.from("municipality_map_ai_chats").upsert(values, {
    onConflict: "id",
  });

  if (error) throw error;
};

const resetConversation = async (
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  analysis: string,
  model: string,
) => {
  const { error: deleteError } = await supabase
    .from("municipality_map_ai_chat_messages")
    .delete()
    .eq("chat_id", chatId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("municipality_map_ai_chat_messages")
    .insert({
      chat_id: chatId,
      role: "assistant",
      content: analysis,
      model,
    });

  if (insertError) throw insertError;
};

const loadConversation = async (
  supabase: ReturnType<typeof createClient>,
  chatId: string,
) => {
  const { data, error } = await supabase
    .from("municipality_map_ai_chat_messages")
    .select("role, content, model, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as ChatMessageRow[]) || [];
};

const syncBatchRow = async (
  supabase: ReturnType<typeof createClient>,
  geminiApiKey: string,
  row: ChatRow,
) => {
  if (!row.gemini_batch_name || !row.gemini_batch_status || !PROCESSING_BATCH_STATES.has(row.gemini_batch_status)) {
    return row;
  }

  const payload = await fetchGeminiJson(
    `https://generativelanguage.googleapis.com/v1beta/${row.gemini_batch_name}`,
    geminiApiKey,
    { method: "GET" },
  );

  const status = extractBatchState(payload) || row.gemini_batch_status;
  const timestamps = extractBatchTimestamps(payload);
  const batchError = extractBatchError(payload);
  const now = new Date().toISOString();

  const updateValues: Record<string, unknown> = {
    id: row.id,
    file_hash: row.file_hash,
    candidate_scope: row.candidate_scope || [],
    title: row.title,
    gemini_model: row.gemini_model || DEFAULT_GEMINI_MODEL,
    gemini_prompt: row.gemini_prompt,
    gemini_batch_name: row.gemini_batch_name,
    gemini_batch_status: status,
    gemini_batch_requested_at: row.gemini_batch_requested_at || timestamps.requestedAt || now,
    gemini_batch_updated_at: timestamps.updatedAt || now,
    gemini_batch_completed_at:
      FINISHED_BATCH_STATES.has(status) && status !== "SYNC_COMPLETED"
        ? timestamps.completedAt || now
        : row.gemini_batch_completed_at,
    gemini_batch_error: batchError,
    gemini_input_mode: row.gemini_input_mode || "csv",
  };

  if (status === "BATCH_STATE_SUCCEEDED") {
    const analysis = extractAnalysisFromBatch(payload);
    if (!analysis) {
      updateValues.gemini_batch_status = "BATCH_STATE_FAILED";
      updateValues.gemini_batch_error = "O Gemini concluiu o batch, mas não retornou texto de análise.";
    } else {
      updateValues.gemini_analysis = analysis;
      updateValues.analysis_created_at = timestamps.completedAt || now;
      updateValues.gemini_batch_error = null;
      await resetConversation(supabase, row.id, analysis, row.gemini_model || DEFAULT_GEMINI_MODEL);
    }
  }

  await upsertHashRow(supabase, updateValues);
  return await selectChatRow(supabase, row.id);
};

const enqueueBatch = async (
  geminiApiKey: string,
  hash: string,
  csvText: string,
  dossierText: string | null,
  candidateNames: string[],
  model: string,
  inputMode: GeminiInputMode,
  customPrompt: string | null,
) => {
  const prompt = buildAnalysisPrompt(inputMode, csvText, dossierText, candidateNames, customPrompt);

  const payload = await fetchGeminiJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchGenerateContent`,
    geminiApiKey,
    {
      method: "POST",
      body: JSON.stringify({
        batch: {
          model: `models/${model}`,
          displayName: `municipality-map-${hash.slice(0, 12)}`,
          inputConfig: {
            requests: [
              {
                request: {
                  model: `models/${model}`,
                  contents: [
                    {
                      parts: [{ text: prompt }],
                    },
                  ],
                },
                metadata: { hash },
              },
            ],
          },
        },
      }),
    },
  );

  return {
    batchName: extractBatchName(payload),
    status: extractBatchState(payload) || "BATCH_STATE_PENDING",
    ...extractBatchTimestamps(payload),
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return jsonResponse({ error: "Secret GEMINI_API_KEY não configurado no Supabase." }, 500);
    }

    const {
      mode = "sync",
      hash,
      chatId,
      csvText,
      dossierText,
      candidateNames = [],
      model,
      customPrompt,
      inputMode,
      message,
      stream,
    } = (await req.json()) as AnalyzeRequestBody;

    const normalizedCandidateNames = normalizeCandidateNames(candidateNames);
    const selectedModel = normalizeModel(model);
    const selectedPrompt = normalizePrompt(customPrompt);
    const selectedInputMode = normalizeInputMode(inputMode);

    if (mode !== "sync_pending" && (!hash || !chatId)) {
      return jsonResponse({ error: "Hash e chatId são obrigatórios para essa ação." }, 400);
    }

    if ((mode === "sync" || mode === "batch") && selectedInputMode === "csv" && !csvText) {
      return jsonResponse({ error: "Conteúdo do CSV é obrigatório para essa ação." }, 400);
    }

    if ((mode === "sync" || mode === "batch") && selectedInputMode === "dossier" && !dossierText?.trim()) {
      return jsonResponse({ error: "O dossiê estruturado é obrigatório para essa ação." }, 400);
    }

    if (mode === "chat" && !message?.trim()) {
      return jsonResponse({ error: "A mensagem para a IA é obrigatória." }, 400);
    }

    if (mode === "sync_pending") {
      const { data, error } = await supabase
        .from("municipality_map_ai_chats")
        .select(
          "id, file_hash, title, candidate_scope, gemini_analysis, gemini_model, gemini_prompt, analysis_created_at, gemini_batch_name, gemini_batch_status, gemini_batch_requested_at, gemini_batch_updated_at, gemini_batch_completed_at, gemini_batch_error, gemini_input_mode",
        )
        .in("gemini_batch_status", [...PROCESSING_BATCH_STATES])
        .limit(50);

      if (error) throw error;

      const rows = (data as ChatRow[]) || [];
      const refreshedRows = await Promise.all(rows.map((row) => syncBatchRow(supabase, geminiApiKey, row)));

      return jsonResponse({
        refreshed: refreshedRows.length,
        processing: refreshedRows.filter((row) => row?.gemini_batch_status && PROCESSING_BATCH_STATES.has(row.gemini_batch_status)).length,
      });
    }

    const existingRow = await selectChatRow(supabase, chatId!);

    if (mode === "chat") {
      if (!existingRow?.gemini_analysis) {
        return jsonResponse({ error: "Gere uma análise antes de iniciar a conversa." }, 400);
      }

      const effectiveModel = model?.trim() || existingRow.gemini_model || DEFAULT_GEMINI_MODEL;
      const effectivePrompt = normalizePrompt(customPrompt) ?? existingRow.gemini_prompt;
      const conversation = await loadConversation(supabase, chatId!);
      const prompt = buildChatPrompt(existingRow.gemini_analysis, conversation, message!.trim(), effectivePrompt);

      const { error: userInsertError } = await supabase.from("municipality_map_ai_chat_messages").insert({
        chat_id: chatId,
        role: "user",
        content: message!.trim(),
        model: effectiveModel,
      });

      if (userInsertError) throw userInsertError;

      if (stream) {
        const encoder = new TextEncoder();

        const responseStream = new ReadableStream({
          async start(controller) {
            let reply = "";

            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start", model: effectiveModel })}\n\n`));

              reply = await streamGeminiText(
                geminiApiKey,
                effectiveModel,
                prompt,
                (chunk) => {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "chunk", delta: chunk })}\n\n`),
                  );
                },
              );

              if (!reply) {
                throw new Error("O Gemini não retornou resposta para a conversa.");
              }

              const { error: assistantInsertError } = await supabase.from("municipality_map_ai_chat_messages").insert({
                chat_id: chatId,
                role: "assistant",
                content: reply,
                model: effectiveModel,
              });

              if (assistantInsertError) throw assistantInsertError;

              await upsertHashRow(supabase, {
                id: chatId,
                file_hash: hash,
                title: existingRow?.title || "Novo chat",
                gemini_model: effectiveModel,
                gemini_prompt: effectivePrompt,
                gemini_input_mode: existingRow.gemini_input_mode || "csv",
                candidate_scope: existingRow.candidate_scope || [],
                updated_at: new Date().toISOString(),
              });

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done", reply, model: effectiveModel })}\n\n`),
              );
              controller.close();
            } catch (streamError) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    error: streamError instanceof Error ? streamError.message : "Falha no streaming da conversa.",
                  })}\n\n`,
                ),
              );
              controller.close();
            }
          },
        });

        return new Response(responseStream, { headers: sseHeaders });
      }

      const reply = await runGeminiText(geminiApiKey, effectiveModel, prompt);

      if (!reply) {
        return jsonResponse({ error: "O Gemini não retornou resposta para a conversa." }, 502);
      }

      const { error: assistantInsertError } = await supabase.from("municipality_map_ai_chat_messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: reply,
        model: effectiveModel,
      });

      if (assistantInsertError) throw assistantInsertError;

      await upsertHashRow(supabase, {
        id: chatId,
        file_hash: hash,
        title: existingRow?.title || "Novo chat",
        gemini_model: effectiveModel,
        gemini_prompt: effectivePrompt,
        gemini_input_mode: existingRow.gemini_input_mode || "csv",
        candidate_scope: existingRow.candidate_scope || [],
        updated_at: new Date().toISOString(),
      });

      return jsonResponse({
        reply,
        model: effectiveModel,
      });
    }

    const sameConfigAsCached =
      existingRow?.gemini_analysis &&
      (existingRow.gemini_model || DEFAULT_GEMINI_MODEL) === selectedModel &&
      (existingRow.gemini_prompt || null) === selectedPrompt &&
      (existingRow.gemini_input_mode || "csv") === selectedInputMode &&
      JSON.stringify(existingRow.candidate_scope || []) === JSON.stringify(normalizedCandidateNames);

    if (sameConfigAsCached) {
      return jsonResponse({
        analysis: existingRow?.gemini_analysis,
        model: existingRow?.gemini_model,
        prompt: existingRow?.gemini_prompt,
        cached: true,
        analysisCreatedAt: existingRow?.analysis_created_at,
        batchStatus: existingRow?.gemini_batch_status,
        inputMode: existingRow?.gemini_input_mode || "csv",
      });
    }

    if (
      mode === "batch" &&
      existingRow?.gemini_batch_name &&
      existingRow.gemini_batch_status &&
      PROCESSING_BATCH_STATES.has(existingRow.gemini_batch_status)
    ) {
      const sameConfigAsPending =
        (existingRow.gemini_model || DEFAULT_GEMINI_MODEL) === selectedModel &&
        (existingRow.gemini_prompt || null) === selectedPrompt &&
        (existingRow.gemini_input_mode || "csv") === selectedInputMode &&
        JSON.stringify(existingRow.candidate_scope || []) === JSON.stringify(normalizedCandidateNames);

      if (sameConfigAsPending) {
        return jsonResponse({
          processing: true,
          cached: false,
          batchStatus: existingRow.gemini_batch_status,
          batchRequestedAt: existingRow.gemini_batch_requested_at,
          model: existingRow.gemini_model,
          prompt: existingRow.gemini_prompt,
          inputMode: existingRow.gemini_input_mode || "csv",
        });
      }

      return jsonResponse(
        {
          error: "Ja existe um batch em andamento para esse hash com outra configuracao. Aguarde concluir ou rode a analise imediata.",
        },
        409,
      );
    }

    if (mode === "batch") {
      const batch = await enqueueBatch(
        geminiApiKey,
        hash!,
        selectedInputMode === "csv" ? csvText! : "",
        selectedInputMode === "dossier" ? dossierText!.trim() : null,
        normalizedCandidateNames,
        selectedModel,
        selectedInputMode,
        selectedPrompt,
      );
      const now = new Date().toISOString();

      await upsertHashRow(supabase, {
        id: chatId,
        file_hash: hash,
        title: existingRow?.title || "Novo chat",
        candidate_scope: normalizedCandidateNames,
        gemini_model: selectedModel,
        gemini_prompt: selectedPrompt,
        gemini_analysis: null,
        analysis_created_at: null,
        gemini_batch_name: batch.batchName,
        gemini_batch_status: batch.status,
        gemini_batch_requested_at: batch.requestedAt || now,
        gemini_batch_updated_at: batch.updatedAt || now,
        gemini_batch_completed_at: null,
        gemini_batch_error: null,
        gemini_input_mode: selectedInputMode,
        updated_at: now,
      });

      return jsonResponse({
        processing: true,
        cached: false,
        batchStatus: batch.status,
        batchRequestedAt: batch.requestedAt || now,
        model: selectedModel,
        prompt: selectedPrompt,
        inputMode: selectedInputMode,
      });
    }

    const analysis = await runGeminiText(
      geminiApiKey,
      selectedModel,
      buildAnalysisPrompt(
        selectedInputMode,
        selectedInputMode === "csv" ? csvText! : null,
        selectedInputMode === "dossier" ? dossierText!.trim() : null,
        normalizedCandidateNames,
        selectedPrompt,
      ),
    );

    if (!analysis) {
      return jsonResponse({ error: "O Gemini não retornou texto de análise para esse CSV." }, 502);
    }

    const now = new Date().toISOString();

    await upsertHashRow(supabase, {
      id: chatId,
      file_hash: hash,
      title: existingRow?.title || "Novo chat",
      candidate_scope: normalizedCandidateNames,
      gemini_analysis: analysis,
      gemini_model: selectedModel,
      gemini_prompt: selectedPrompt,
      analysis_created_at: now,
      gemini_batch_status: "SYNC_COMPLETED",
      gemini_batch_updated_at: now,
      gemini_batch_completed_at: now,
      gemini_batch_error: null,
      gemini_input_mode: selectedInputMode,
      updated_at: now,
    });

    await resetConversation(supabase, chatId!, analysis, selectedModel);

    return jsonResponse({
      analysis,
      model: selectedModel,
      prompt: selectedPrompt,
      cached: false,
      analysisCreatedAt: now,
      batchStatus: "SYNC_COMPLETED",
      inputMode: selectedInputMode,
    });
  } catch (error) {
    console.error("analyze-municipality-map-csv error", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Falha inesperada ao analisar o CSV.",
      },
      500,
    );
  }
});

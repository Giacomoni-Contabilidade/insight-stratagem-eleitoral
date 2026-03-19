import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject, Geometry } from "geojson";
import { AlertCircle, History, Loader2, MapPinned, MessageSquare, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/dataParser";
import {
  normalizeMunicipalityName,
  parseMunicipalityVotesCsv,
  type MunicipalityVotesDataset,
} from "@/lib/municipalityVotes";
import { supabase } from "@/integrations/supabase/client";

interface GeoFeatureProperties {
  GEOCODIGO: string;
  NOME: string;
  UF: string;
}

interface GeoFeature {
  type: "Feature";
  properties: GeoFeatureProperties;
  geometry: Geometry;
}

interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

interface PopulationRecord {
  codigo_ibge: string;
  municipality_name: string;
  population: number;
  reference_year: number;
  uf: string;
}

interface PopulationDataset {
  source: string;
  referenceDate: string;
  municipalities: Record<string, { name: string; population: number }>;
}

interface CachedHashAnalysis {
  file_hash?: string;
  candidate_names: string[] | null;
  gemini_analysis: string | null;
  gemini_input_mode?: GeminiInputMode | null;
  gemini_model: string | null;
  gemini_prompt: string | null;
  analysis_created_at: string | null;
  gemini_batch_status: string | null;
  gemini_batch_requested_at: string | null;
  gemini_batch_updated_at: string | null;
  gemini_batch_error: string | null;
}

interface GeminiAnalysisResponse {
  analysis?: string;
  model?: string;
  inputMode?: GeminiInputMode;
  cached: boolean;
  processing?: boolean;
  batchStatus?: string | null;
  batchRequestedAt?: string | null;
  analysisCreatedAt?: string | null;
  prompt?: string | null;
  reply?: string;
  error?: string;
}

interface GeminiChatStreamEvent {
  type: "start" | "chunk" | "done" | "error";
  delta?: string;
  reply?: string;
  model?: string;
  error?: string;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at: string;
}

interface AiChatSession {
  id: string;
  file_hash: string;
  title: string;
  candidate_scope: string[];
  gemini_analysis: string | null;
  gemini_model: string | null;
  gemini_prompt: string | null;
  gemini_input_mode: GeminiInputMode;
  gemini_batch_status: string | null;
  gemini_batch_requested_at: string | null;
  gemini_batch_updated_at: string | null;
  gemini_batch_error: string | null;
  analysis_created_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportHistoryItem {
  id: string;
  file_hash: string;
  candidate_names: string[];
  gemini_analysis: string | null;
  gemini_batch_status: string | null;
  created_at: string;
}

interface SelectedMunicipalityDetails {
  name: string;
  uf: string;
  normalizedName: string;
  votes: number;
  population: number | null;
  votesPerHabitant: number | null;
  votesPerThousand: number | null;
}

type GeminiInputMode = "csv" | "dossier";

interface PersistedMunicipalityMapState {
  dataset: MunicipalityVotesDataset | null;
  csvContent: string;
  selectedCandidate: string;
  selectedState: string;
  lastImportedHash: string;
  geminiAnalysis: string;
  geminiModel: string;
  analysisCreatedAt: string;
  analysisLoadedFromCache: boolean;
  batchStatus: string;
  batchRequestedAt: string;
  batchUpdatedAt: string;
  batchError: string;
  selectedGeminiModel: string;
  selectedGeminiInputMode: GeminiInputMode;
  selectedAnalysisCandidates: string[];
  customGeminiPrompt: string;
}

const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

const GEOJSON_PATH_BY_STATE = Object.fromEntries(
  BRAZILIAN_STATES.map((state) => [state, state === "SP" ? "/sp-municipios.min.geojson" : `/geojson-states/${state}.min.json`]),
) as Record<string, string>;

const VOTE_SCALE = [
  { min: 30000, color: "hsl(149 43% 23%)", label: "> 30.000" },
  { min: 10000, color: "hsl(169 42% 30%)", label: ">= 10.000" },
  { min: 5000, color: "hsl(187 41% 38%)", label: ">= 5.000" },
  { min: 1000, color: "hsl(197 34% 48%)", label: ">= 1.000" },
  { min: 1, color: "hsl(43 78% 62%)", label: "< 1.000" },
] as const;

const NO_VOTE_COLOR = "hsl(200 18% 90%)";
const MUNICIPALITY_MAP_STORAGE_KEY = "municipality-map-view-state";
const PROCESSING_BATCH_STATES = new Set(["BATCH_STATE_PENDING", "BATCH_STATE_RUNNING"]);
const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

const GEMINI_INPUT_MODE_OPTIONS: Array<{ value: GeminiInputMode; label: string; description: string }> = [
  {
    value: "dossier",
    label: "Dossiê estruturado",
    description: "Resumo rico e organizado, mais eficiente para a IA.",
  },
  {
    value: "csv",
    label: "CSV completo",
    description: "Envia o arquivo bruto inteiro para análise.",
  },
];

const createHashFromString = async (value: string): Promise<string> => {
  const contentBuffer = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", contentBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const buildCanonicalDatasetSignature = (dataset: MunicipalityVotesDataset): string => {
  const votesByStateSource = Object.keys(dataset.candidateVotesByState).length > 0
    ? dataset.candidateVotesByState
    : Object.fromEntries([
        [
          dataset.inferredState || "UNKNOWN",
          Object.fromEntries(
            Object.entries(dataset.candidateVotes).map(([candidate, votes]) => [candidate, votes]),
          ),
        ],
      ]);

  const states = Object.keys(votesByStateSource).sort();

  const canonicalStates = states.map((state) => {
    const candidates = Object.keys(votesByStateSource[state] || {}).sort();

    return [
      state,
      candidates.map((candidate) => [
        candidate,
        Object.entries(votesByStateSource[state]?.[candidate] || {})
          .sort(([municipalityA], [municipalityB]) => municipalityA.localeCompare(municipalityB))
          .map(([municipality, votes]) => [municipality, votes]),
      ]),
    ];
  });

  return JSON.stringify({
    format: dataset.format,
    states,
    candidates: [...dataset.candidateOptions].sort(),
    votes: canonicalStates,
  });
};

const createRawCsvHash = async (content: string): Promise<string> => createHashFromString(content);

const createCanonicalDatasetHash = async (dataset: MunicipalityVotesDataset): Promise<string> =>
  createHashFromString(buildCanonicalDatasetSignature(dataset));

const registerMunicipalityMapImport = async (fileHash: string, candidateNames: string[]) => {
  const { error } = await supabase
    .from("municipality_map_import_hashes")
    .upsert(
      {
        file_hash: fileHash,
        candidate_names: candidateNames,
      },
      {
        onConflict: "file_hash",
      },
    );

  if (error) {
    throw new Error(error.message || "Não foi possível registrar o hash do CSV no banco.");
  }
};

const selectCachedHashRow = async (hashes: string[]) => {
  const uniqueHashes = [...new Set(hashes.filter(Boolean))];
  if (uniqueHashes.length === 0) return null;

  const { data, error } = await supabase
    .from("municipality_map_import_hashes")
    .select(
      "file_hash, candidate_names, gemini_analysis, gemini_input_mode, gemini_model, gemini_prompt, analysis_created_at, gemini_batch_status, gemini_batch_requested_at, gemini_batch_updated_at, gemini_batch_error",
    )
    .in("file_hash", uniqueHashes);

  if (error) {
    throw error;
  }

  const rows = (data as CachedHashAnalysis[] | null) || [];
  return uniqueHashes
    .map((hash) => rows.find((row) => row.file_hash === hash) || null)
    .find(Boolean) || null;
};

const getFillColor = (votes: number): string => {
  if (votes <= 0) return NO_VOTE_COLOR;
  return VOTE_SCALE.find((range) => votes >= range.min)?.color || NO_VOTE_COLOR;
};

const municipalityNameMap = (geoJson: GeoFeatureCollection | null) => {
  if (!geoJson) return new Set<string>();
  return new Set(geoJson.features.map((feature) => normalizeMunicipalityName(feature.properties.NOME)));
};

const loadPopulationDataForState = async (state: string): Promise<PopulationDataset | null> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const { data: { session } } = await supabase.auth.getSession();

  if (!supabaseUrl || !publishableKey || !session?.access_token) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/ibge_municipal_populations_latest?select=codigo_ibge,municipality_name,population,reference_year,uf&uf=eq.${state}`,
    {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Falha ao carregar a base populacional de ${state}.`);
  }

  const rows = (await response.json()) as PopulationRecord[];
  const latestYear = rows.reduce((maxYear, row) => Math.max(maxYear, row.reference_year || 0), 0);

  return {
    source: "IBGE - população municipal",
    referenceDate: latestYear ? String(latestYear) : "",
    municipalities: Object.fromEntries(
      rows.map((row) => [
        row.codigo_ibge,
        {
          name: row.municipality_name,
          population: row.population,
        },
      ]),
    ),
  };
};

export const MunicipalityMapView = () => {
  const [geoJson, setGeoJson] = useState<GeoFeatureCollection | null>(null);
  const [populationData, setPopulationData] = useState<PopulationDataset | null>(null);
  const [dataset, setDataset] = useState<MunicipalityVotesDataset | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [lastImportedHash, setLastImportedHash] = useState<string>("");
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>("");
  const [geminiModel, setGeminiModel] = useState<string>("");
  const [analysisCreatedAt, setAnalysisCreatedAt] = useState<string>("");
  const [analysisLoadedFromCache, setAnalysisLoadedFromCache] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [batchRequestedAt, setBatchRequestedAt] = useState<string>("");
  const [batchUpdatedAt, setBatchUpdatedAt] = useState<string>("");
  const [batchError, setBatchError] = useState<string>("");
  const [analyzingWithGemini, setAnalyzingWithGemini] = useState(false);
  const [submittingBatchAnalysis, setSubmittingBatchAnalysis] = useState(false);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(GEMINI_MODEL_OPTIONS[0].value);
  const [selectedGeminiInputMode, setSelectedGeminiInputMode] = useState<GeminiInputMode>("dossier");
  const [selectedAnalysisCandidates, setSelectedAnalysisCandidates] = useState<string[]>([]);
  const [customGeminiPrompt, setCustomGeminiPrompt] = useState<string>("");
  const [aiChats, setAiChats] = useState<AiChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [loadingAiChats, setLoadingAiChats] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<AiChatSession | null>(null);
  const [topbarSlotElement, setTopbarSlotElement] = useState<HTMLElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [error, setError] = useState<string>("");
  const [loadingGeoJson, setLoadingGeoJson] = useState(false);
  const [selectedMunicipalityDetails, setSelectedMunicipalityDetails] = useState<SelectedMunicipalityDetails | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const activeBoundsRef = useRef<string>("");
  const hasRestoredStateRef = useRef(false);

  useEffect(() => {
    if (hasRestoredStateRef.current) return;
    hasRestoredStateRef.current = true;

    try {
      const storedState = window.localStorage.getItem(MUNICIPALITY_MAP_STORAGE_KEY);
      if (!storedState) return;

      const parsedState = JSON.parse(storedState) as PersistedMunicipalityMapState;

      setDataset(parsedState.dataset || null);
      setCsvContent(parsedState.csvContent || "");
      setSelectedCandidate(parsedState.selectedCandidate || "");
      setSelectedState(parsedState.selectedState || "");
      setLastImportedHash(parsedState.lastImportedHash || "");
      setGeminiAnalysis(parsedState.geminiAnalysis || "");
      setGeminiModel(parsedState.geminiModel || "");
      setAnalysisCreatedAt(parsedState.analysisCreatedAt || "");
      setAnalysisLoadedFromCache(Boolean(parsedState.analysisLoadedFromCache));
      setBatchStatus(parsedState.batchStatus || "");
      setBatchRequestedAt(parsedState.batchRequestedAt || "");
      setBatchUpdatedAt(parsedState.batchUpdatedAt || "");
      setBatchError(parsedState.batchError || "");
      setSelectedGeminiModel(parsedState.selectedGeminiModel || GEMINI_MODEL_OPTIONS[0].value);
      setSelectedGeminiInputMode(parsedState.selectedGeminiInputMode || "dossier");
      setSelectedAnalysisCandidates(parsedState.selectedAnalysisCandidates || []);
      setCustomGeminiPrompt(parsedState.customGeminiPrompt || "");
    } catch {
      window.localStorage.removeItem(MUNICIPALITY_MAP_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredStateRef.current) return;

    const stateToPersist: PersistedMunicipalityMapState = {
      dataset,
      csvContent,
      selectedCandidate,
      selectedState,
      lastImportedHash,
      geminiAnalysis,
      geminiModel,
      analysisCreatedAt,
      analysisLoadedFromCache,
      batchStatus,
      batchRequestedAt,
      batchUpdatedAt,
      batchError,
      selectedGeminiModel,
      selectedGeminiInputMode,
      selectedAnalysisCandidates,
      customGeminiPrompt,
    };

    const hasContent =
      Boolean(dataset) ||
      Boolean(csvContent) ||
      Boolean(lastImportedHash) ||
      Boolean(geminiAnalysis) ||
      Boolean(batchStatus);

    if (!hasContent) {
      window.localStorage.removeItem(MUNICIPALITY_MAP_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(MUNICIPALITY_MAP_STORAGE_KEY, JSON.stringify(stateToPersist));
  }, [
    analysisCreatedAt,
    analysisLoadedFromCache,
    batchError,
    batchRequestedAt,
    batchStatus,
    batchUpdatedAt,
    csvContent,
    customGeminiPrompt,
    dataset,
    geminiAnalysis,
    geminiModel,
    lastImportedHash,
    selectedGeminiModel,
    selectedGeminiInputMode,
    selectedAnalysisCandidates,
    selectedCandidate,
    selectedState,
  ]);

  useEffect(() => {
    if (!dataset) {
      setSelectedAnalysisCandidates([]);
      return;
    }

    setSelectedAnalysisCandidates((current) => {
      const available = new Set(dataset.candidateOptions);
      const filtered = current.filter((candidate) => available.has(candidate));
      return filtered.length > 0 ? filtered : dataset.candidateOptions;
    });
  }, [dataset]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
      minZoom: 4,
      maxZoom: 12,
      zoomDelta: 0.5,
      zoomSnap: 0.5,
    });

    map.setView([-14.5, -52], 4.2);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const clearLayer = () => {
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
    };

    if (!selectedState) {
      clearLayer();
      setGeoJson(null);
      setPopulationData(null);
      setLoadingGeoJson(false);

      if (mapRef.current) {
        mapRef.current.setMaxBounds(undefined);
        mapRef.current.setView([-14.5, -52], 4.2);
      }
      activeBoundsRef.current = "";
      return () => {
        active = false;
      };
    }

    const loadAssets = async () => {
      setLoadingGeoJson(true);

      try {
        const geoJsonPath = GEOJSON_PATH_BY_STATE[selectedState];

        if (!geoJsonPath) {
          throw new Error(`A malha de ${selectedState} ainda não está disponível.`);
        }

        const geoJsonResponse = await fetch(geoJsonPath);

        if (!geoJsonResponse.ok) {
          throw new Error(`Falha ao carregar a malha de municípios de ${selectedState}.`);
        }

        const geoJsonData = (await geoJsonResponse.json()) as GeoFeatureCollection;
        const populationDataset = await loadPopulationDataForState(selectedState).catch(() => null);

        if (!active) return;

        setGeoJson(geoJsonData);
        setPopulationData(populationDataset);
      } catch (loadError) {
        if (!active) return;
        clearLayer();
        setGeoJson(null);
        setPopulationData(null);
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a malha.");
      } finally {
        if (active) {
          setLoadingGeoJson(false);
        }
      }
    };

    setError("");
    loadAssets();

    return () => {
      active = false;
    };
  }, [selectedState]);

  const geoMunicipalities = useMemo(() => municipalityNameMap(geoJson), [geoJson]);
  const municipalityLabels = useMemo(() => {
    if (!geoJson) return new Map<string, string>();

    return new Map(
      geoJson.features.map((feature) => [
        normalizeMunicipalityName(feature.properties.NOME),
        feature.properties.NOME,
      ]),
    );
  }, [geoJson]);

  const availableStates = useMemo(() => {
    if (!dataset) return [];
    if (dataset.states.length > 0) return dataset.states;
    return dataset.inferredState ? [dataset.inferredState] : [];
  }, [dataset]);

  const selectedVotes = useMemo(() => {
    if (!dataset || !selectedCandidate || !selectedState) return {};
    return dataset.candidateVotesByState[selectedState]?.[selectedCandidate] || {};
  }, [dataset, selectedCandidate, selectedState]);

  const activeMunicipalityNames = useMemo(() => {
    if (!dataset || !selectedState) return [];
    return dataset.municipalityNamesByState[selectedState] || [];
  }, [dataset, selectedState]);

  const mapStats = useMemo(() => {
    const entries = Object.entries(selectedVotes);
    const matchedEntries = entries.filter(([municipality]) => geoMunicipalities.has(municipality));
    const totalVotes = matchedEntries.reduce((sum, [, votes]) => sum + votes, 0);
    const topMunicipality = matchedEntries.sort((a, b) => b[1] - a[1])[0];
    const unmatchedMunicipalities = activeMunicipalityNames.filter(
      (name) => !geoMunicipalities.has(normalizeMunicipalityName(name)),
    );

    return {
      totalVotes,
      municipalitiesWithVotes: matchedEntries.filter(([, votes]) => votes > 0).length,
      matchedMunicipalities: matchedEntries.length,
      topMunicipality,
      maxVotes: matchedEntries.reduce((max, [, votes]) => Math.max(max, votes), 0),
      unmatchedMunicipalities,
    };
  }, [activeMunicipalityNames, geoMunicipalities, selectedVotes]);

  const rankedMunicipalities = useMemo(() => {
    return Object.entries(selectedVotes)
      .filter(([municipality, votes]) => geoMunicipalities.has(municipality) && votes > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [geoMunicipalities, selectedVotes]);

  useEffect(() => {
    setSelectedMunicipalityDetails(null);
  }, [selectedCandidate, selectedState, lastImportedHash]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    if (!geoJson || !selectedState) {
      mapRef.current.setMaxBounds(undefined);
      return;
    }

    const layer = L.geoJSON(geoJson as GeoJsonObject, {
      style: (feature) => {
        const municipalityName = normalizeMunicipalityName(
          (feature?.properties as GeoFeatureProperties | undefined)?.NOME || "",
        );
        const votes = selectedVotes[municipalityName] || 0;

        return {
          color: "hsl(200 20% 65%)",
          weight: 0.8,
          fillColor: getFillColor(votes),
          fillOpacity: votes > 0 ? 0.9 : 0.55,
        };
      },
      onEachFeature: (feature, leafletLayer) => {
        const properties = feature.properties as GeoFeatureProperties;
        const municipalityName = normalizeMunicipalityName(properties.NOME);
        const votes = selectedVotes[municipalityName] || 0;
        const population = populationData?.municipalities[properties.GEOCODIGO]?.population || 0;
        const votesPerHabitant = population > 0 ? votes / population : 0;
        const votesPerThousand = votesPerHabitant * 1000;
        const populationLine = population > 0
          ? `População IBGE: ${formatNumber(population)}<br />Votos por habitante: ${formatNumber(votesPerHabitant, 4)}<br />Votos por 1 mil habitantes: ${formatNumber(votesPerThousand, 2)}`
          : "População IBGE indisponível para este estado.";

        leafletLayer.bindTooltip(
          `
            <div style="min-width: 170px;">
              <strong>${properties.NOME}</strong><br />
              ${selectedCandidate ? `${selectedCandidate}<br />` : ""}
              Votos: ${formatNumber(votes)}
            </div>
          `,
          {
            sticky: true,
          },
        );

        leafletLayer.bindPopup(
          `
            <div style="min-width: 220px; line-height: 1.5;">
              <strong>${properties.NOME} - ${properties.UF}</strong><br />
              ${selectedCandidate ? `${selectedCandidate}<br />` : ""}
              Votos: ${formatNumber(votes)}<br />
              ${populationLine}
            </div>
          `,
        );

        leafletLayer.on({
          mouseover: () => {
            leafletLayer.setStyle({
              weight: 1.6,
              color: "hsl(200 46% 20%)",
            });
          },
          mouseout: () => {
            layer.resetStyle(leafletLayer);
          },
          click: () => {
            setSelectedMunicipalityDetails({
              name: properties.NOME,
              uf: properties.UF,
              normalizedName: municipalityName,
              votes,
              population: population > 0 ? population : null,
              votesPerHabitant: population > 0 ? votesPerHabitant : null,
              votesPerThousand: population > 0 ? votesPerThousand : null,
            });
          },
        });
      },
    });

    layer.addTo(mapRef.current);
    layerRef.current = layer;

    if (activeBoundsRef.current !== selectedState) {
      mapRef.current.fitBounds(layer.getBounds(), { padding: [20, 20] });
      activeBoundsRef.current = selectedState;
    }

    const constrainedBounds = layer.getBounds().pad(0.08);
    mapRef.current.setMaxBounds(constrainedBounds);
    mapRef.current.panInsideBounds(constrainedBounds, { animate: false });
  }, [geoJson, populationData, selectedCandidate, selectedState, selectedVotes]);

  const dossierPayload = useMemo(() => {
    if (!dataset || !selectedState || selectedAnalysisCandidates.length === 0) return null;

    const candidateSummaries = selectedAnalysisCandidates.map((candidate) => {
      const candidateVotes = dataset.candidateVotesByState[selectedState]?.[candidate] || {};
      const votesEntries = Object.entries(candidateVotes)
        .filter(([, votes]) => votes > 0)
        .sort((a, b) => b[1] - a[1]);

      const municipalitiesDetailed = votesEntries.map(([municipality, votes]) => {
        const feature = geoJson?.features.find(
          ({ properties }) => normalizeMunicipalityName(properties.NOME) === municipality,
        );
        const population = feature ? populationData?.municipalities[feature.properties.GEOCODIGO]?.population || 0 : 0;

        return {
          municipio: municipalityLabels.get(municipality) || municipality,
          uf: feature?.properties.UF || selectedState,
          votos: votes,
          populacao_ibge: population > 0 ? population : null,
          votos_por_habitante: population > 0 ? Number((votes / population).toFixed(6)) : null,
          votos_por_1000_habitantes: population > 0 ? Number((((votes / population) * 1000).toFixed(2))) : null,
        };
      });

      const topByVotes = municipalitiesDetailed.slice(0, 25);
      const topByDensity = [...municipalitiesDetailed]
        .filter((item) => item.votos_por_1000_habitantes !== null)
        .sort((a, b) => (b.votos_por_1000_habitantes || 0) - (a.votos_por_1000_habitantes || 0))
        .slice(0, 25);

      const voteValues = municipalitiesDetailed.map((item) => item.votos).sort((a, b) => a - b);
      const medianVotes =
        voteValues.length === 0
          ? 0
          : voteValues.length % 2 === 1
            ? voteValues[(voteValues.length - 1) / 2]
            : (voteValues[voteValues.length / 2 - 1] + voteValues[voteValues.length / 2]) / 2;

      return {
        candidato: candidate,
        resumo: {
          votos_totais: voteValues.reduce((sum, votes) => sum + votes, 0),
          municipios_com_votos: municipalitiesDetailed.length,
          max_votos: voteValues[voteValues.length - 1] || 0,
          mediana_votos: medianVotes,
          media_votos: voteValues.length > 0 ? Number((voteValues.reduce((sum, votes) => sum + votes, 0) / voteValues.length).toFixed(2)) : 0,
        },
        top_por_votos: topByVotes,
        top_por_densidade: topByDensity,
      };
    });

    return JSON.stringify(
      {
        dataset: {
          arquivo: dataset.fileName,
          formato: dataset.format,
          uf_ativa: selectedState,
          candidatura_ativa_no_mapa: selectedCandidate,
          candidatos_incluidos_na_analise: selectedAnalysisCandidates,
          candidatos_disponiveis: dataset.candidateOptions,
          hash: lastImportedHash,
          total_linhas: dataset.totalRows,
        },
        resumo: {
          municipios_reconhecidos_na_malha: mapStats.matchedMunicipalities,
          municipios_fora_da_malha: mapStats.unmatchedMunicipalities,
          base_populacional: populationData?.referenceDate
            ? `${populationData.source} (${populationData.referenceDate})`
            : null,
        },
        candidatos: candidateSummaries,
        municipio_selecionado: selectedMunicipalityDetails
          ? {
              nome: selectedMunicipalityDetails.name,
              uf: selectedMunicipalityDetails.uf,
              candidatos: selectedAnalysisCandidates.map((candidate) => {
                const votes =
                  dataset.candidateVotesByState[selectedState]?.[candidate]?.[selectedMunicipalityDetails.normalizedName] || 0;

                return {
                  candidato: candidate,
                  votos: votes,
                  populacao_ibge: selectedMunicipalityDetails.population,
                  votos_por_habitante:
                    selectedMunicipalityDetails.population && selectedMunicipalityDetails.population > 0
                      ? Number((votes / selectedMunicipalityDetails.population).toFixed(6))
                      : null,
                  votos_por_1000_habitantes:
                    selectedMunicipalityDetails.population && selectedMunicipalityDetails.population > 0
                      ? Number((((votes / selectedMunicipalityDetails.population) * 1000).toFixed(2)))
                      : null,
                };
              }),
            }
          : null,
      },
      null,
      2,
    );
  }, [
    dataset,
    geoJson?.features,
    lastImportedHash,
    mapStats.matchedMunicipalities,
    mapStats.unmatchedMunicipalities,
    municipalityLabels,
    populationData?.municipalities,
    populationData?.referenceDate,
    populationData?.source,
    selectedAnalysisCandidates,
    selectedCandidate,
    selectedMunicipalityDetails,
    selectedState,
  ]);

  const analysisCsvText = useMemo(() => {
    if (!dataset || !selectedState || selectedAnalysisCandidates.length === 0) return "";

    const municipalities = [...new Set(dataset.municipalityNamesByState[selectedState] || [])].sort((a, b) => a.localeCompare(b));
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, "\"\"")}"`;
    const header = ["Municipio", ...selectedAnalysisCandidates].map(escapeCsv).join(",");

    const rows = municipalities.map((municipality) => {
      const normalizedMunicipality = normalizeMunicipalityName(municipality);
      const values = [
        municipality,
        ...selectedAnalysisCandidates.map(
          (candidate) => dataset.candidateVotesByState[selectedState]?.[candidate]?.[normalizedMunicipality] || 0,
        ),
      ];

      return values.map(escapeCsv).join(",");
    });

    return [header, ...rows].join("\n");
  }, [dataset, selectedAnalysisCandidates, selectedState]);

  const invokeGeminiAnalysis = async (payload: Record<string, unknown>) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/analyze-municipality-map-csv`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = (await response.json()) as GeminiAnalysisResponse;

    if (!response.ok) {
      throw new Error(result.error || "Não foi possível gerar a análise do Gemini.");
    }

    return result;
  };

  const streamGeminiChat = async (
    payload: Record<string, unknown>,
    handlers: {
      onChunk: (chunk: string) => void;
      onDone: (reply: string, model: string) => void;
    },
  ) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/analyze-municipality-map-csv`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...payload, stream: true }),
      },
    );

    if (!response.ok || !response.body) {
      const result = (await response.json().catch(() => ({}))) as GeminiAnalysisResponse;
      throw new Error(result.error || "Não foi possível iniciar o streaming da conversa.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullReply = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventBlock of events) {
        const dataLine = eventBlock
          .split("\n")
          .find((line) => line.trim().startsWith("data:"));

        if (!dataLine) continue;

        const dataText = dataLine.replace(/^data:\s*/, "");
        if (!dataText) continue;

        const event = JSON.parse(dataText) as GeminiChatStreamEvent;

        if (event.type === "chunk" && event.delta) {
          fullReply += event.delta;
          handlers.onChunk(event.delta);
        }

        if (event.type === "done") {
          handlers.onDone(event.reply || fullReply, event.model || selectedGeminiModel);
        }

        if (event.type === "error") {
          throw new Error(event.error || "Falha no streaming da resposta da IA.");
        }
      }
    }
  };

  const applyActiveChatState = async (chat: AiChatSession | null) => {
    if (!chat) {
      setActiveChatId("");
      setGeminiAnalysis("");
      setGeminiModel("");
      setAnalysisCreatedAt("");
      setAnalysisLoadedFromCache(false);
      setBatchStatus("");
      setBatchRequestedAt("");
      setBatchUpdatedAt("");
      setBatchError("");
      setChatMessages([]);
      return;
    }

    setActiveChatId(chat.id);

    setGeminiAnalysis(chat.gemini_analysis || "");
    setGeminiModel(chat.gemini_model || "");
    setSelectedGeminiModel(chat.gemini_model || GEMINI_MODEL_OPTIONS[0].value);
    setSelectedGeminiInputMode(chat.gemini_input_mode || "dossier");
    setCustomGeminiPrompt(chat.gemini_prompt || "");
    setSelectedAnalysisCandidates(chat.candidate_scope?.length ? chat.candidate_scope : dataset?.candidateOptions || []);
    setAnalysisCreatedAt(chat.analysis_created_at || "");
    setBatchStatus(chat.gemini_batch_status || "");
    setBatchRequestedAt(chat.gemini_batch_requested_at || "");
    setBatchUpdatedAt(chat.gemini_batch_updated_at || "");
    setBatchError(chat.gemini_batch_error || "");
    setAnalysisLoadedFromCache(false);

    await loadChatMessages(chat.id, {
      analysis: chat.gemini_analysis || "",
      model: chat.gemini_model || GEMINI_MODEL_OPTIONS[0].value,
      createdAt: chat.analysis_created_at || chat.created_at,
    });
  };

  const loadAiChats = async (hash: string, preferredChatId?: string) => {
    setLoadingAiChats(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("municipality_map_ai_chats")
        .select(
          "id, file_hash, title, candidate_scope, gemini_analysis, gemini_model, gemini_prompt, gemini_input_mode, gemini_batch_status, gemini_batch_requested_at, gemini_batch_updated_at, gemini_batch_error, analysis_created_at, created_at, updated_at",
        )
        .eq("file_hash", hash)
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;

      const chats = (data as AiChatSession[]) || [];
      setAiChats(chats);

      const nextActiveChatId = preferredChatId && chats.some((chat) => chat.id === preferredChatId)
        ? preferredChatId
        : "";

      if (nextActiveChatId) {
        const activeChat = chats.find((chat) => chat.id === nextActiveChatId) || null;
        await applyActiveChatState(activeChat);
      } else {
        await applyActiveChatState(null);
      }
    } finally {
      setLoadingAiChats(false);
    }
  };

  const loadImportHistory = async () => {
    setLoadingHistory(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("municipality_map_import_hashes")
        .select("id, file_hash, candidate_names, gemini_analysis, gemini_batch_status, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setImportHistory((data as ImportHistoryItem[]) || []);
    } catch (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Não foi possível carregar o histórico.";
      toast.error(message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadChatMessages = async (
    chatId: string,
    fallback?: { analysis: string; model: string; createdAt: string },
  ) => {
    const { data, error: fetchError } = await supabase
      .from("municipality_map_ai_chat_messages")
      .select("id, role, content, model, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    const rows = (data as ChatMessage[]) || [];

    if (rows.length === 0 && fallback?.analysis) {
      setChatMessages([
        {
          role: "assistant",
          content: fallback.analysis,
          model: fallback.model,
          created_at: fallback.createdAt,
        },
      ]);
      return;
    }

    setChatMessages(rows);
  };

  const refreshActiveChatFromDatabase = async (chatId: string) => {
    const { data, error: chatError } = await supabase
      .from("municipality_map_ai_chats")
      .select(
        "id, file_hash, title, candidate_scope, gemini_analysis, gemini_model, gemini_prompt, gemini_input_mode, gemini_batch_status, gemini_batch_requested_at, gemini_batch_updated_at, gemini_batch_error, analysis_created_at, created_at, updated_at",
      )
      .eq("id", chatId)
      .maybeSingle();

    if (chatError) {
      throw chatError;
    }

    const chat = (data as AiChatSession | null) || null;
    if (!chat) return;

    const nextChats = [
      chat,
      ...aiChats.filter((item) => item.id !== chat.id),
    ].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

    setAiChats(nextChats);
    await applyActiveChatState(chat);
  };

  const refreshProcessingAnalyses = async (syncPending = true) => {
    try {
      if (syncPending) {
        await invokeGeminiAnalysis({ mode: "sync_pending" });
      }

      if (lastImportedHash) {
        await loadAiChats(lastImportedHash, activeChatId || undefined);
      }
    } catch (refreshError) {
      console.error(refreshError);
    }
  };

  const buildChatTitle = () => {
    const timestamp = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (selectedAnalysisCandidates.length === 1) {
      return `${selectedAnalysisCandidates[0]} • ${timestamp}`;
    }

    if (selectedAnalysisCandidates.length > 1) {
      return `${selectedAnalysisCandidates.length} candidatos • ${timestamp}`;
    }

    return `Novo chat • ${timestamp}`;
  };

  const createAiChat = async () => {
    if (!lastImportedHash) {
      throw new Error("Importe um CSV antes de criar um chat.");
    }

    const chatId = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = buildChatTitle();

    const { error: insertError } = await supabase.from("municipality_map_ai_chats").insert({
      id: chatId,
      file_hash: lastImportedHash,
      title,
      candidate_scope: selectedAnalysisCandidates,
      gemini_model: selectedGeminiModel,
      gemini_input_mode: selectedGeminiInputMode,
      gemini_prompt: customGeminiPrompt || null,
      gemini_batch_status: null,
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      throw new Error(insertError.message || "Não foi possível criar um novo chat.");
    }

    return chatId;
  };

  const handleDeleteChat = async () => {
    if (!chatToDelete) return;

    try {
      const { error: deleteError } = await supabase
        .from("municipality_map_ai_chats")
        .delete()
        .eq("id", chatToDelete.id);

      if (deleteError) {
        throw deleteError;
      }

      toast.success("Chat excluído.");
      const deletedId = chatToDelete.id;
      setChatToDelete(null);
      await loadAiChats(
        lastImportedHash,
        activeChatId === deletedId ? undefined : activeChatId || undefined,
      );
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o chat.";
      toast.error(message);
    }
  };

  const handleAnalyzeWithGemini = async (mode: "sync" | "batch") => {
    if (!lastImportedHash || !csvContent) {
      toast.error("Importe um CSV antes de pedir a análise.");
      return;
    }

    if (selectedAnalysisCandidates.length === 0) {
      toast.error("Selecione pelo menos um candidato para a análise.");
      return;
    }

    if (mode === "sync") {
      setAnalyzingWithGemini(true);
    } else {
      setSubmittingBatchAnalysis(true);
    }

    try {
      const chatId = await createAiChat();
      setActiveChatId(chatId);
      setGeminiAnalysis("");
      setGeminiModel("");
      setAnalysisCreatedAt("");
      setAnalysisLoadedFromCache(false);
      setBatchStatus("");
      setBatchRequestedAt("");
      setBatchUpdatedAt("");
      setBatchError("");
      setChatMessages([]);
      setChatInput("");

      const result = await invokeGeminiAnalysis({
        mode,
        hash: lastImportedHash,
        chatId,
        csvText: selectedGeminiInputMode === "csv" ? analysisCsvText : undefined,
        candidateNames: selectedAnalysisCandidates,
        model: selectedGeminiModel,
        customPrompt: customGeminiPrompt,
        inputMode: selectedGeminiInputMode,
        dossierText: selectedGeminiInputMode === "dossier" ? dossierPayload : undefined,
      });

      if (result.processing) {
        setBatchStatus(result.batchStatus || "BATCH_STATE_PENDING");
        setBatchRequestedAt(result.batchRequestedAt || new Date().toISOString());
        setBatchUpdatedAt(result.batchRequestedAt || new Date().toISOString());
        setBatchError("");
        await loadAiChats(lastImportedHash, chatId);
        toast.success("Análise enviada por batch.");
        return;
      }

      setGeminiAnalysis(result.analysis || "");
      setGeminiModel(result.model || selectedGeminiModel);
      setSelectedGeminiModel(result.model || selectedGeminiModel);
      setSelectedGeminiInputMode(result.inputMode || selectedGeminiInputMode);
      setCustomGeminiPrompt(result.prompt || "");
      setAnalysisCreatedAt(result.analysisCreatedAt || "");
      setAnalysisLoadedFromCache(result.cached);
      setBatchStatus(result.batchStatus || "SYNC_COMPLETED");
      setBatchRequestedAt(result.analysisCreatedAt || "");
      setBatchUpdatedAt(result.analysisCreatedAt || "");
      setBatchError("");
      await loadChatMessages(chatId);
      await loadAiChats(lastImportedHash, chatId);
      toast.success(result.cached ? "Análise reaproveitada do cache." : "Análise do Gemini gerada com sucesso.");
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : "Erro ao analisar o CSV com Gemini.";
      toast.error(message);
    } finally {
      if (mode === "sync") {
        setAnalyzingWithGemini(false);
      } else {
        setSubmittingBatchAnalysis(false);
      }
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      const fileText = await file.text();
      const parsedDataset = parseMunicipalityVotesCsv(fileText, file.name);
      const canonicalHash = await createCanonicalDatasetHash(parsedDataset);
      const rawHash = await createRawCsvHash(fileText);
      const initialState = parsedDataset.states[0] || parsedDataset.inferredState || "";

      if (!initialState) {
        throw new Error("Esse CSV não informou uma UF válida. Use um arquivo com estado identificado para renderizar o mapa.");
      }

      const existingHashRow = await selectCachedHashRow([canonicalHash, rawHash]);
      const resolvedHash = existingHashRow?.file_hash || canonicalHash;

      if (!existingHashRow) {
        await registerMunicipalityMapImport(canonicalHash, [...parsedDataset.candidateOptions].sort());
      }

      setDataset(parsedDataset);
      setCsvContent(fileText);
      setSelectedCandidate(parsedDataset.candidateOptions[0] || "");
      setSelectedState(initialState);
      setLastImportedHash(resolvedHash);
      setAiChats([]);
      setActiveChatId("");
      setGeminiAnalysis("");
      setGeminiModel("");
      setAnalysisCreatedAt("");
      setBatchStatus("");
      setBatchRequestedAt("");
      setBatchUpdatedAt("");
      setBatchError("");
      setChatMessages([]);
      await loadAiChats(resolvedHash);
    } catch (parseError) {
      setDataset(null);
      setCsvContent("");
      setSelectedCandidate("");
      setSelectedState("");
      setLastImportedHash("");
      setGeminiAnalysis("");
      setGeminiModel("");
      setAnalysisCreatedAt("");
      setAnalysisLoadedFromCache(false);
      setBatchStatus("");
      setBatchRequestedAt("");
      setBatchUpdatedAt("");
      setBatchError("");
      setAiChats([]);
      setActiveChatId("");
      setChatMessages([]);
      setChatInput("");
      setError(parseError instanceof Error ? parseError.message : "Não foi possível ler esse CSV.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSendChatMessage = async () => {
    const message = chatInput.trim();

    if (!lastImportedHash || !activeChatId || !geminiAnalysis) {
      toast.error("Gere uma análise antes de conversar com a IA.");
      return;
    }

    if (!message) {
      toast.error("Digite uma mensagem para continuar a conversa.");
      return;
    }

    setSendingChatMessage(true);
    try {
      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: `user-${now}`,
        role: "user",
        content: message,
        model: selectedGeminiModel,
        created_at: now,
      };
      const assistantMessageId = `assistant-${now}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        model: selectedGeminiModel,
        created_at: now,
      };

      setChatMessages((current) => [...current, userMessage, assistantMessage]);
      setChatInput("");

      let streamedReply = "";

      await streamGeminiChat(
        {
          mode: "chat",
          hash: lastImportedHash,
          chatId: activeChatId,
          model: selectedGeminiModel,
          customPrompt: customGeminiPrompt,
          message,
        },
        {
          onChunk: (chunk) => {
            streamedReply += chunk;
            setChatMessages((current) =>
              current.map((item) =>
                item.id === assistantMessageId
                  ? { ...item, content: streamedReply }
                  : item,
              ),
            );
          },
          onDone: (reply, model) => {
            setChatMessages((current) =>
              current.map((item) =>
                item.id === assistantMessageId
                  ? { ...item, content: reply, model }
                  : item,
              ),
            );
          },
        },
      );
      await refreshActiveChatFromDatabase(activeChatId);
      toast.success("Mensagem enviada.");
    } catch (chatError) {
      setChatMessages((current) => current.filter((item) => !String(item.id || "").startsWith("assistant-") && !String(item.id || "").startsWith("user-")));
      const messageText = chatError instanceof Error ? chatError.message : "Não foi possível continuar a conversa.";
      toast.error(messageText);
    } finally {
      setSendingChatMessage(false);
    }
  };

  const isBatchProcessing = PROCESSING_BATCH_STATES.has(batchStatus);

  useEffect(() => {
    refreshProcessingAnalyses(true).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!lastImportedHash) return;
    loadAiChats(lastImportedHash, activeChatId || undefined).catch(() => undefined);
  }, [lastImportedHash]);

  useEffect(() => {
    if (!activeChatId || sendingChatMessage) return;

    refreshActiveChatFromDatabase(activeChatId).catch(() => undefined);
  }, [activeChatId]);

  useEffect(() => {
    if (!aiChats.some((chat) => PROCESSING_BATCH_STATES.has(chat.gemini_batch_status || ""))) return;

    const intervalId = window.setInterval(() => {
      refreshProcessingAnalyses(true).catch(() => undefined);
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [aiChats]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setTopbarSlotElement(document.getElementById("municipality-map-topbar-slot"));
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    loadImportHistory().catch(() => undefined);
  }, [historyOpen]);

  const activeChat = aiChats.find((chat) => chat.id === activeChatId) || null;
  const canSendCustomMessage = Boolean(geminiAnalysis) && !PROCESSING_BATCH_STATES.has(activeChat?.gemini_batch_status || "");

  const topbarContent = (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">Mapa municipal de votos</div>
          <div className="truncate text-xs text-muted-foreground">
            {dataset
              ? `${dataset.fileName} • ${selectedState || "sem UF"} • ${selectedCandidate || "sem candidatura"}`
              : "Envie um CSV municipal para preencher o mapa."}
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-2">
          {lastImportedHash && (
            <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              Hash <span className="font-medium text-foreground">{lastImportedHash.slice(0, 10)}...</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-10 bg-background/90">
              <History className="mr-2 h-4 w-4" />
              Ver histórico
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Histórico de datasets do mapa</DialogTitle>
            </DialogHeader>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {loadingHistory ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando histórico...
                </div>
              ) : importHistory.length > 0 ? (
                importHistory.map((item) => {
                  const analysisStatus = item.gemini_analysis
                    ? "Análise disponível"
                    : PROCESSING_BATCH_STATES.has(item.gemini_batch_status || "")
                      ? "Análise em processamento"
                      : "Sem análise";

                  return (
                    <div key={item.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Hash</p>
                            <p className="break-all font-mono text-xs text-foreground">{item.file_hash}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Candidatos</p>
                            <p className="text-sm text-foreground">
                              {item.candidate_names.length > 0 ? item.candidate_names.join(", ") : "Nenhum candidato registrado"}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                          <Badge variant={item.gemini_analysis ? "default" : "secondary"}>{analysisStatus}</Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Nenhum dataset foi carregado ainda.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="w-[240px]">
          <Input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="h-10 bg-background/90" />
        </div>

        <div className="w-[260px]">
          <Select
            value={selectedCandidate}
            onValueChange={setSelectedCandidate}
            disabled={!dataset || dataset.candidateOptions.length === 0}
          >
            <SelectTrigger className="h-10 bg-background/90">
              <SelectValue placeholder="Selecione a candidatura" />
            </SelectTrigger>
            <SelectContent>
              {dataset?.candidateOptions.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {candidate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {topbarSlotElement ? createPortal(topbarContent, topbarSlotElement) : (
        <div className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-lg backdrop-blur">
          {topbarContent}
        </div>
      )}

      <div className="space-y-3">
        <div className="municipality-map-shell overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm xl:h-[620px]">
          <div className="grid h-full items-stretch gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-h-0 min-w-0 flex-col border-b border-border/50 xl:border-b-0 xl:border-r">
              <div className="relative min-h-0 flex-1">
                <div
                  ref={mapContainerRef}
                  className="h-full min-h-[360px] w-full bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.18),transparent_35%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.45))]"
                />

                {!dataset && !error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                    <div className="max-w-md rounded-2xl border border-border/70 bg-card/90 p-6 text-center shadow-card backdrop-blur">
                      <Upload className="mx-auto mb-3 h-8 w-8 text-primary" />
                      <p className="font-medium">Envie um CSV de `recortes_municipio`</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A malha só aparece depois da importação e segue a UF detectada no arquivo.
                      </p>
                    </div>
                  </div>
                )}

                {dataset && !selectedState && !error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                    <div className="max-w-md rounded-2xl border border-border/70 bg-card/90 p-6 text-center shadow-card backdrop-blur">
                      <MapPinned className="mx-auto mb-3 h-8 w-8 text-primary" />
                      <p className="font-medium">A UF não foi identificada no arquivo</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Use um CSV com UF válida para que a malha seja carregada automaticamente.
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-4 left-4 z-20 flex items-end gap-2">
                  <div className="relative z-20 rounded-xl border border-border/60 bg-card/90 px-3 py-2.5 text-xs shadow-card backdrop-blur">
                    <p className="mb-2 font-medium text-foreground">Escala de votos</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-8 rounded-full border border-black/5"
                          style={{ backgroundColor: NO_VOTE_COLOR }}
                        />
                        <span>0</span>
                      </div>
                      {VOTE_SCALE.map((range) => (
                        <div key={range.label} className="flex items-center gap-2">
                          <span
                            className="h-3 w-8 rounded-full border border-black/5"
                            style={{ backgroundColor: range.color }}
                          />
                          <span>{range.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative z-20 rounded-xl border border-border/60 bg-card/90 px-3 py-2.5 text-xs shadow-card backdrop-blur">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">UF</span>
                        <span className="text-xs font-semibold text-foreground">{selectedState || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Votos</span>
                        <span className="text-xs font-semibold text-foreground">{formatNumber(mapStats.totalVotes)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Munic.</span>
                        <span className="text-xs font-semibold text-foreground">{formatNumber(mapStats.municipalitiesWithVotes)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex h-full min-h-0 flex-col p-4 xl:p-5">
              <div className="mb-4 shrink-0">
                <h3 className="text-[15px] font-semibold">Top municípios</h3>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                  Maiores volumes para a candidatura selecionada na UF ativa.
                </p>
              </div>

              {selectedMunicipalityDetails && (
                <div className="mb-4 shrink-0 rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {selectedMunicipalityDetails.name} - {selectedMunicipalityDetails.uf}
                      </p>
                      {selectedCandidate && (
                        <p className="mt-1 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          {selectedCandidate}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      Selecionado
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>Votos</span>
                      <span className="font-medium text-foreground">{formatNumber(selectedMunicipalityDetails.votes)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>População IBGE</span>
                      <span className="font-medium text-foreground">
                        {selectedMunicipalityDetails.population
                          ? formatNumber(selectedMunicipalityDetails.population)
                          : "Indisponível"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Votos por habitante</span>
                      <span className="font-medium text-foreground">
                        {selectedMunicipalityDetails.votesPerHabitant !== null
                          ? formatNumber(selectedMunicipalityDetails.votesPerHabitant, 4)
                          : "Indisponível"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Votos por 1 mil hab.</span>
                      <span className="font-medium text-foreground">
                        {selectedMunicipalityDetails.votesPerThousand !== null
                          ? formatNumber(selectedMunicipalityDetails.votesPerThousand, 2)
                          : "Indisponível"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {rankedMunicipalities.length > 0 ? (
                  rankedMunicipalities.map(([municipality, votes], index) => (
                    <button
                      key={municipality}
                      type="button"
                      onClick={() => {
                        const feature = geoJson?.features.find(
                          ({ properties }) => normalizeMunicipalityName(properties.NOME) === municipality,
                        );
                        const population = feature ? populationData?.municipalities[feature.properties.GEOCODIGO]?.population || 0 : 0;

                        setSelectedMunicipalityDetails({
                          name: municipalityLabels.get(municipality) || municipality,
                          uf: feature?.properties.UF || selectedState,
                          normalizedName: municipality,
                          votes,
                          population: population > 0 ? population : null,
                          votesPerHabitant: population > 0 ? votes / population : null,
                          votesPerThousand: population > 0 ? (votes / population) * 1000 : null,
                        });
                      }}
                      className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-[13px] font-medium leading-5">
                          {index + 1}. {municipalityLabels.get(municipality) || municipality}
                        </p>
                      </div>
                      <span className="text-[13px] tabular-nums text-muted-foreground">{formatNumber(votes)}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Importe um arquivo e selecione uma candidatura.</p>
                )}

              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          {!selectedState
            ? "Nenhuma UF selecionada."
            : loadingGeoJson
              ? "Carregando malha..."
              : "Malha municipal carregada."}{" "}
          {mapStats.unmatchedMunicipalities.length === 0
            ? "Todos os municípios da UF ativa foram reconhecidos."
            : `${mapStats.unmatchedMunicipalities.length} município(s) do CSV não bateram com a malha.`}{" "}
          {mapStats.topMunicipality
            ? `Maior concentração: ${municipalityLabels.get(mapStats.topMunicipality[0]) || mapStats.topMunicipality[0]} com ${formatNumber(mapStats.topMunicipality[1])} votos. `
            : ""}
          {populationData?.referenceDate
            ? `Base populacional: ${populationData.source} (${populationData.referenceDate}).`
            : ""}
          {mapStats.unmatchedMunicipalities.length > 0
            ? ` Não encontrados na malha: [${mapStats.unmatchedMunicipalities.slice(0, 10).join(", ")}${mapStats.unmatchedMunicipalities.length > 10 ? ", ..." : ""}].`
            : ""}
        </div>
      </div>

      <Card className="glass-panel border-border/50">
        <CardContent className="p-0">
          <div className="grid min-h-[720px] lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="border-b border-border/50 p-5 lg:border-b-0 lg:border-r">
              <div className="space-y-5">
                <div>
                  <p className="text-base font-semibold">Nova análise com IA</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cada análise cria um chat novo para este hash canônico.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Modelo da LLM
                    </p>
                    <Select value={selectedGeminiModel} onValueChange={setSelectedGeminiModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {GEMINI_MODEL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Contexto enviado
                    </p>
                    <Select
                      value={selectedGeminiInputMode}
                      onValueChange={(value) => setSelectedGeminiInputMode(value as GeminiInputMode)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        {GEMINI_INPUT_MODE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {GEMINI_INPUT_MODE_OPTIONS.find((option) => option.value === selectedGeminiInputMode)?.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Candidatos na análise
                      </p>
                      {dataset?.candidateOptions?.length ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAnalysisCandidates(dataset.candidateOptions)}
                        >
                          Todos
                        </Button>
                      ) : null}
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="truncate">
                            {selectedAnalysisCandidates.length === 0
                              ? "Selecione os candidatos"
                              : `${selectedAnalysisCandidates.length} candidato(s)`}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[320px] p-3">
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {dataset?.candidateOptions.map((candidate) => {
                            const checked = selectedAnalysisCandidates.includes(candidate);

                            return (
                              <label
                                key={candidate}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-3"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(nextChecked) => {
                                    setSelectedAnalysisCandidates((current) => {
                                      if (nextChecked) {
                                        return current.includes(candidate) ? current : [...current, candidate];
                                      }

                                      const next = current.filter((item) => item !== candidate);
                                      return next.length > 0 ? next : current;
                                    });
                                  }}
                                />
                                <span className="text-sm leading-5">{candidate}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Prompt opcional
                    </p>
                    <Textarea
                      value={customGeminiPrompt}
                      onChange={(event) => setCustomGeminiPrompt(event.target.value)}
                      placeholder="Ex.: foque em padrões regionais, densidade e outliers."
                      className="min-h-[110px]"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <Button
                      variant="outline"
                      onClick={() => handleAnalyzeWithGemini("sync")}
                      disabled={!dataset || !lastImportedHash || analyzingWithGemini || submittingBatchAnalysis}
                    >
                      {analyzingWithGemini ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Análise imediata
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleAnalyzeWithGemini("batch")}
                      disabled={!dataset || !lastImportedHash || submittingBatchAnalysis || analyzingWithGemini}
                    >
                      {submittingBatchAnalysis ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Novo chat por batch
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Chats deste hash</p>
                      <p className="text-xs text-muted-foreground">
                        Todos os usuários veem o mesmo histórico.
                      </p>
                    </div>
                    {loadingAiChats ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  </div>

                  <div className="space-y-2">
                    {aiChats.length > 0 ? (
                      aiChats.map((chat) => {
                        const isActive = chat.id === activeChatId;
                        const statusLabel = chat.gemini_analysis
                          ? "Com análise"
                          : PROCESSING_BATCH_STATES.has(chat.gemini_batch_status || "")
                            ? "Em processamento"
                            : "Sem análise";

                        return (
                          <div
                            key={chat.id}
                            className={`rounded-xl border p-3 transition-colors ${
                              isActive ? "border-primary/40 bg-primary/5" : "border-border/50 bg-muted/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                disabled={sendingChatMessage}
                                onClick={() => {
                                  setChatInput("");
                                  refreshActiveChatFromDatabase(chat.id).catch(() => undefined);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                  <p className="truncate text-sm font-medium">{chat.title}</p>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {chat.candidate_scope?.length > 0 ? chat.candidate_scope.join(", ") : "Sem candidatos definidos"}
                                </p>
                                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Badge variant={chat.gemini_analysis ? "default" : "secondary"}>{statusLabel}</Badge>
                                  <span>{new Date(chat.updated_at).toLocaleString("pt-BR")}</span>
                                </div>
                              </button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setChatToDelete(chat)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                        Nenhum chat ainda para este hash. Crie a primeira análise à esquerda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <section className="flex min-h-[720px] flex-col p-5">
              <div className="border-b border-border/50 pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">
                        {activeChat?.title || "Conversa com a IA"}
                      </h3>
                      {activeChat?.gemini_analysis ? (
                        <Badge>Análise pronta</Badge>
                      ) : PROCESSING_BATCH_STATES.has(activeChat?.gemini_batch_status || "") ? (
                        <Badge variant="secondary">Análise em processamento</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeChat
                        ? `${activeChat.gemini_model || selectedGeminiModel} • ${activeChat.gemini_input_mode === "dossier" ? "dossiê estruturado" : "CSV completo"}`
                        : "Escolha um chat à esquerda ou crie uma nova análise."}
                    </p>
                  </div>

                  {activeChat ? (
                    <div className="text-right text-xs text-muted-foreground">
                      {activeChat.analysis_created_at
                        ? `Primeira análise em ${new Date(activeChat.analysis_created_at).toLocaleString("pt-BR")}`
                        : activeChat.gemini_batch_requested_at
                          ? `Solicitado em ${new Date(activeChat.gemini_batch_requested_at).toLocaleString("pt-BR")}`
                          : "Aguardando primeira análise"}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col pt-5">
                {activeChat ? (
                  <>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {chatMessages.length > 0 ? (
                        chatMessages.map((message, index) => (
                          <div
                            key={`${message.id || message.created_at}-${index}`}
                            className={
                              message.role === "assistant"
                                ? "max-w-[92%] rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm shadow-sm"
                                : "ml-auto max-w-[92%] rounded-2xl bg-primary/10 p-4 text-sm"
                            }
                          >
                            <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                              {message.role === "assistant" ? "IA" : "Você"}
                              {message.model ? ` • ${message.model}` : ""}
                            </div>
                            <div className="whitespace-pre-wrap leading-6">{message.content}</div>
                          </div>
                        ))
                      ) : PROCESSING_BATCH_STATES.has(activeChat.gemini_batch_status || "") ? (
                        <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 text-sm text-muted-foreground">
                          Análise em processamento. Assim que o Gemini responder, este chat vai mostrar a primeira mensagem da IA aqui.
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-5 text-sm text-muted-foreground">
                          Este chat ainda não tem uma primeira análise. Gere uma análise nova na sidebar para começar a conversa.
                        </div>
                      )}
                    </div>

                    {batchError ? (
                      <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                        {batchError}
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
                      <Textarea
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder={
                          canSendCustomMessage
                            ? "Escreva sua pergunta ou peça um refinamento."
                            : "A mensagem personalizada só é liberada depois da primeira análise da IA."
                        }
                        className="min-h-[110px]"
                        disabled={!canSendCustomMessage || sendingChatMessage}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          O prompt opcional da sidebar vale para a criação da análise. Aqui você envia só a próxima mensagem.
                        </p>
                        <Button
                          onClick={handleSendChatMessage}
                          disabled={!canSendCustomMessage || sendingChatMessage}
                        >
                          {sendingChatMessage ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Respondendo...
                            </>
                          ) : (
                            "Enviar mensagem"
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
                    <div className="max-w-md space-y-2">
                      <p className="text-base font-medium">Nenhum chat selecionado</p>
                      <p className="text-sm text-muted-foreground">
                        Escolha um chat existente na sidebar ou crie uma nova análise para este hash.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={Boolean(chatToDelete)} onOpenChange={(open) => {
        if (!open) setChatToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chat</AlertDialogTitle>
            <AlertDialogDescription>
              {chatToDelete
                ? `Tem certeza que deseja excluir "${chatToDelete.title}"? Essa ação remove o chat e todas as mensagens dele para todos os usuários.`
                : "Tem certeza que deseja excluir este chat?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChat}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

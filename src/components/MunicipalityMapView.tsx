import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject, Geometry } from "geojson";
import { AlertCircle, MapPinned, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/dataParser";
import {
  normalizeMunicipalityName,
  parseMunicipalityVotesCsv,
  type MunicipalityVotesDataset,
} from "@/lib/municipalityVotes";

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

interface PopulationDataset {
  source: string;
  reference_date: string;
  municipalities: Record<string, { name: string; population: number }>;
}

const GEOJSON_PATH = "/sp-municipios.min.geojson";
const POPULATION_PATH = "/ibge-populacao-sp.json";

const VOTE_SCALE = [
  { min: 30000, color: "hsl(149 43% 23%)", label: "> 30.000" },
  { min: 10000, color: "hsl(169 42% 30%)", label: ">= 10.000" },
  { min: 5000, color: "hsl(187 41% 38%)", label: ">= 5.000" },
  { min: 1000, color: "hsl(197 34% 48%)", label: ">= 1.000" },
  { min: 1, color: "hsl(43 78% 62%)", label: "< 1.000" },
] as const;

const NO_VOTE_COLOR = "hsl(200 18% 90%)";

const getFillColor = (votes: number): string => {
  if (votes <= 0) return NO_VOTE_COLOR;

  return VOTE_SCALE.find((range) => votes >= range.min)?.color || NO_VOTE_COLOR;
};

const municipalityNameMap = (geoJson: GeoFeatureCollection | null) => {
  if (!geoJson) return new Set<string>();
  return new Set(geoJson.features.map((feature) => normalizeMunicipalityName(feature.properties.NOME)));
};

export const MunicipalityMapView = () => {
  const [geoJson, setGeoJson] = useState<GeoFeatureCollection | null>(null);
  const [populationData, setPopulationData] = useState<PopulationDataset | null>(null);
  const [dataset, setDataset] = useState<MunicipalityVotesDataset | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loadingGeoJson, setLoadingGeoJson] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const hasFitBoundsRef = useRef(false);

  useEffect(() => {
    let active = true;

    const loadAssets = async () => {
      try {
        const [geoJsonResponse, populationResponse] = await Promise.all([
          fetch(GEOJSON_PATH),
          fetch(POPULATION_PATH),
        ]);

        if (!geoJsonResponse.ok) {
          throw new Error("Falha ao carregar a malha de municípios de SP.");
        }

        if (!populationResponse.ok) {
          throw new Error("Falha ao carregar a base de população do IBGE.");
        }

        const [geoJsonData, populationJson] = await Promise.all([
          geoJsonResponse.json() as Promise<GeoFeatureCollection>,
          populationResponse.json() as Promise<PopulationDataset>,
        ]);

        if (active) {
          setGeoJson(geoJsonData);
          setPopulationData(populationJson);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o mapa.");
        }
      } finally {
        if (active) {
          setLoadingGeoJson(false);
        }
      }
    };

    loadAssets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
      minZoom: 6,
      maxZoom: 11,
      zoomDelta: 0.5,
      zoomSnap: 0.5,
      maxBoundsViscosity: 1,
    });

    map.setView([-22.5, -48.5], 6.4);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const geoMunicipalities = useMemo(() => municipalityNameMap(geoJson), [geoJson]);
  const municipalityLabels = useMemo(() => {
    if (!geoJson) return new Map<string, string>();

    return new Map(
      geoJson.features.map((feature) => [
        normalizeMunicipalityName(feature.properties.NOME),
        feature.properties.NOME,
      ])
    );
  }, [geoJson]);

  const selectedVotes = useMemo(() => {
    if (!dataset || !selectedCandidate) return {};
    return dataset.candidateVotes[selectedCandidate] || {};
  }, [dataset, selectedCandidate]);

  const mapStats = useMemo(() => {
    const entries = Object.entries(selectedVotes);
    const matchedEntries = entries.filter(([municipality]) => geoMunicipalities.has(municipality));
    const totalVotes = matchedEntries.reduce((sum, [, votes]) => sum + votes, 0);
    const topMunicipality = matchedEntries.sort((a, b) => b[1] - a[1])[0];
    const unmatchedMunicipalities = dataset
      ? dataset.municipalityNames.filter((name) => !geoMunicipalities.has(normalizeMunicipalityName(name)))
      : [];

    return {
      totalVotes,
      municipalitiesWithVotes: matchedEntries.filter(([, votes]) => votes > 0).length,
      matchedMunicipalities: matchedEntries.length,
      topMunicipality,
      maxVotes: matchedEntries.reduce((max, [, votes]) => Math.max(max, votes), 0),
      unmatchedMunicipalities,
    };
  }, [dataset, geoMunicipalities, selectedVotes]);

  const rankedMunicipalities = useMemo(() => {
    return Object.entries(selectedVotes)
      .filter(([municipality, votes]) => geoMunicipalities.has(municipality) && votes > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [geoMunicipalities, selectedVotes]);

  useEffect(() => {
    if (!mapRef.current || !geoJson) return;

    if (layerRef.current) {
      layerRef.current.remove();
    }

    const layer = L.geoJSON(geoJson as GeoJsonObject, {
      style: (feature) => {
        const municipalityName = normalizeMunicipalityName(
          (feature?.properties as GeoFeatureProperties | undefined)?.NOME || ""
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
          }
        );

        leafletLayer.bindPopup(
          `
            <div style="min-width: 220px; line-height: 1.5;">
              <strong>${properties.NOME}</strong><br />
              ${selectedCandidate ? `${selectedCandidate}<br />` : ""}
              Votos: ${formatNumber(votes)}<br />
              População IBGE 2022: ${formatNumber(population)}<br />
              Votos por habitante: ${formatNumber(votesPerHabitant, 4)}<br />
              Votos por 1 mil habitantes: ${formatNumber(votesPerThousand, 2)}
            </div>
          `
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
        });
      },
    });

    layer.addTo(mapRef.current);
    layerRef.current = layer;

    if (!hasFitBoundsRef.current) {
      mapRef.current.fitBounds(layer.getBounds(), { padding: [20, 20] });
      hasFitBoundsRef.current = true;
    }

    const constrainedBounds = layer.getBounds().pad(0.08);
    mapRef.current.setMaxBounds(constrainedBounds);
    mapRef.current.panInsideBounds(constrainedBounds, { animate: false });
  }, [geoJson, populationData, selectedCandidate, selectedVotes]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      const fileText = await file.text();
      const parsedDataset = parseMunicipalityVotesCsv(fileText, file.name);
      setDataset(parsedDataset);
      setSelectedCandidate(parsedDataset.candidateOptions[0] || "");
    } catch (parseError) {
      setDataset(null);
      setSelectedCandidate("");
      setError(parseError instanceof Error ? parseError.message : "Não foi possível ler esse CSV.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mapa municipal de votos em SP</h1>
          <p className="text-sm text-muted-foreground">
            Importe o CSV de `recortes_municipio` e o mapa é montado automaticamente por município.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="w-full sm:w-[320px]">
            <Input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
          </div>

          <div className="w-full sm:w-[280px]">
            <Select
              value={selectedCandidate}
              onValueChange={setSelectedCandidate}
              disabled={!dataset || dataset.candidateOptions.length === 0}
            >
              <SelectTrigger>
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

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="glass-panel border-border/50">
          <CardHeader className="pb-2">
            <CardDescription>Arquivo</CardDescription>
            <CardTitle className="text-base">{dataset?.fileName || "Nenhum CSV importado"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {dataset ? `${dataset.totalRows} linhas lidas no formato ${dataset.format}.` : "Use o CSV pivotado ou o CSV longo."}
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardHeader className="pb-2">
            <CardDescription>Total de votos mapeados</CardDescription>
            <CardTitle>{formatNumber(mapStats.totalVotes)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {selectedCandidate || "Escolha uma candidatura para analisar."}
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardHeader className="pb-2">
            <CardDescription>Municípios com votos</CardDescription>
            <CardTitle>{formatNumber(mapStats.municipalitiesWithVotes)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatNumber(mapStats.matchedMunicipalities)} municípios reconhecidos na malha.
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardHeader className="pb-2">
            <CardDescription>Maior concentração</CardDescription>
            <CardTitle>
              {mapStats.topMunicipality ? formatNumber(mapStats.topMunicipality[1]) : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {mapStats.topMunicipality
              ? municipalityLabels.get(mapStats.topMunicipality[0]) || mapStats.topMunicipality[0]
              : "Sem dados para destacar."}
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="glass-panel overflow-hidden border-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Mapa coroplético dos municípios</CardTitle>
            </div>
            <CardDescription>
              Tons mais escuros representam mais votos para a candidatura selecionada. Clique no município para ver votos por habitante.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <div
                ref={mapContainerRef}
                className="h-[820px] w-full bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.18),transparent_35%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.45))]"
              />

              {!dataset && !error && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                  <div className="max-w-md rounded-2xl border border-border/70 bg-card/90 p-6 text-center shadow-card backdrop-blur">
                    <Upload className="mx-auto mb-3 h-8 w-8 text-primary" />
                    <p className="font-medium">Envie um CSV de `recortes_municipio`</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      O formato pivotado é o mais direto, mas o formato longo também funciona.
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-4 rounded-xl border border-border/60 bg-card/90 px-4 py-3 text-xs shadow-card backdrop-blur">
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
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Top municípios</CardTitle>
              <CardDescription>Maiores volumes para a candidatura selecionada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankedMunicipalities.length > 0 ? (
                rankedMunicipalities.map(([municipality, votes], index) => (
                  <div key={municipality} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {municipalityLabels.get(municipality) || municipality}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatNumber(votes)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Importe um arquivo e escolha uma candidatura.</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Compatibilidade da malha</CardTitle>
              <CardDescription>Conferência de municípios encontrados no GeoJSON de SP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{loadingGeoJson ? "Carregando malha..." : "Malha municipal carregada."}</p>
              <p>
                {mapStats.unmatchedMunicipalities.length === 0
                  ? "Todos os municípios do CSV foram reconhecidos."
                  : `${mapStats.unmatchedMunicipalities.length} município(s) do CSV não bateram com a malha.`}
              </p>
              {mapStats.unmatchedMunicipalities.length > 0 && (
                <div className="rounded-lg bg-muted/30 p-3 text-xs leading-6">
                  {mapStats.unmatchedMunicipalities.slice(0, 12).join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export interface MunicipalityVotesDataset {
  fileName: string;
  format: "pivot" | "long";
  candidateOptions: string[];
  candidateVotes: Record<string, Record<string, number>>;
  candidateVotesByState: Record<string, Record<string, Record<string, number>>>;
  municipalityNames: string[];
  municipalityNamesByState: Record<string, string[]>;
  states: string[];
  inferredState: string | null;
  totalRows: number;
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

const parseNumber = (value: string): number => {
  const trimmed = value.trim();

  if (!trimmed) return 0;

  const normalized = trimmed
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const detectDelimiter = (headerLine: string): string => {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
};

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^\uFEFF/, "").trim());
};

const parseCsvText = (csvText: string): string[][] => {
  const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalizedText) return [];

  const lines = normalizedText.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => parseCsvLine(line, delimiter));
};

export const normalizeMunicipalityName = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeStateCode = (value: string | undefined): string | null => {
  const normalized = (value || "").trim().toUpperCase();
  return BRAZILIAN_STATES.includes(normalized as (typeof BRAZILIAN_STATES)[number]) ? normalized : null;
};

const inferStateFromFileName = (fileName: string): string | null => {
  const normalizedName = fileName.toUpperCase().replace(/[^A-Z]/g, " ");
  const tokens = normalizedName.split(/\s+/).filter(Boolean);
  const matchedStates = [...new Set(tokens.filter((token) => normalizeStateCode(token)))];
  return matchedStates.length === 1 ? matchedStates[0] : null;
};

const parsePivotDataset = (rows: string[][], fileName: string): MunicipalityVotesDataset => {
  const [header, ...body] = rows;
  const candidateOptions = header.slice(1).map((value) => value.trim()).filter(Boolean);
  const inferredState = inferStateFromFileName(fileName);

  if (candidateOptions.length === 0) {
    throw new Error("O CSV pivotado precisa ter pelo menos uma coluna de candidatura.");
  }

  const candidateVotes = Object.fromEntries(
    candidateOptions.map((candidate) => [candidate, {} as Record<string, number>])
  );

  const municipalityNames: string[] = [];
  const municipalityNamesByState: Record<string, string[]> = inferredState ? { [inferredState]: [] } : {};
  const candidateVotesByState: Record<string, Record<string, Record<string, number>>> = inferredState
    ? Object.fromEntries([
        [
          inferredState,
          Object.fromEntries(candidateOptions.map((candidate) => [candidate, {} as Record<string, number>])),
        ],
      ])
    : {};

  body.forEach((row) => {
    const municipality = row[0]?.trim();
    if (!municipality) return;

    municipalityNames.push(municipality);
    const normalizedMunicipality = normalizeMunicipalityName(municipality);
    if (inferredState) {
      municipalityNamesByState[inferredState].push(municipality);
    }

    candidateOptions.forEach((candidate, candidateIndex) => {
      const voteValue = parseNumber(row[candidateIndex + 1] || "0");
      candidateVotes[candidate][normalizedMunicipality] = voteValue;
      if (inferredState) {
        candidateVotesByState[inferredState][candidate][normalizedMunicipality] = voteValue;
      }
    });
  });

  return {
    fileName,
    format: "pivot",
    candidateOptions,
    candidateVotes,
    municipalityNames,
    candidateVotesByState,
    municipalityNamesByState,
    states: inferredState ? [inferredState] : [],
    inferredState,
    totalRows: body.length,
  };
};

const parseLongDataset = (rows: string[][], fileName: string): MunicipalityVotesDataset => {
  const [header, ...body] = rows;
  const headerIndex = Object.fromEntries(header.map((column, index) => [column.trim().toLowerCase(), index]));

  const candidacyIndex = headerIndex.candidatura;
  const municipalityIndex = headerIndex.municipio;
  const votesIndex = headerIndex.votos;
  const stateIndex = headerIndex.uf;

  if (candidacyIndex === undefined || municipalityIndex === undefined || votesIndex === undefined || stateIndex === undefined) {
    throw new Error("O CSV longo precisa das colunas Candidatura, UF, Municipio e Votos.");
  }

  const candidateVotes: Record<string, Record<string, number>> = {};
  const candidateVotesByState: Record<string, Record<string, Record<string, number>>> = {};
  const municipalityNames = new Set<string>();
  const municipalityNamesByState = new Map<string, Set<string>>();
  const states = new Set<string>();

  body.forEach((row) => {
    const candidate = row[candidacyIndex]?.trim();
    const municipality = row[municipalityIndex]?.trim();
    const state = normalizeStateCode(row[stateIndex]);

    if (!candidate || !municipality || !state) return;

    municipalityNames.add(municipality);
    states.add(state);
    const normalizedMunicipality = normalizeMunicipalityName(municipality);
    const votes = parseNumber(row[votesIndex] || "0");

    if (!candidateVotes[candidate]) {
      candidateVotes[candidate] = {};
    }

    candidateVotes[candidate][`${state}:${normalizedMunicipality}`] =
      (candidateVotes[candidate][`${state}:${normalizedMunicipality}`] || 0) + votes;

    if (!candidateVotesByState[state]) {
      candidateVotesByState[state] = {};
    }
    if (!candidateVotesByState[state][candidate]) {
      candidateVotesByState[state][candidate] = {};
    }
    candidateVotesByState[state][candidate][normalizedMunicipality] =
      (candidateVotesByState[state][candidate][normalizedMunicipality] || 0) + votes;

    if (!municipalityNamesByState.has(state)) {
      municipalityNamesByState.set(state, new Set<string>());
    }
    municipalityNamesByState.get(state)?.add(municipality);
  });

  return {
    fileName,
    format: "long",
    candidateOptions: Object.keys(candidateVotes),
    candidateVotes,
    candidateVotesByState,
    municipalityNames: [...municipalityNames],
    municipalityNamesByState: Object.fromEntries(
      [...municipalityNamesByState.entries()].map(([state, names]) => [state, [...names]])
    ),
    states: [...states],
    inferredState: states.size === 1 ? [...states][0] : inferStateFromFileName(fileName),
    totalRows: body.length,
  };
};

export const parseMunicipalityVotesCsv = (
  csvText: string,
  fileName = "arquivo.csv"
): MunicipalityVotesDataset => {
  const rows = parseCsvText(csvText);

  if (rows.length < 2) {
    throw new Error("O arquivo precisa ter cabeçalho e pelo menos uma linha de dados.");
  }

  const header = rows[0].map((value) => value.replace(/^\uFEFF/, "").trim());
  const lowerHeader = header.map((value) => value.toLowerCase());

  const isLongFormat =
    lowerHeader.includes("candidatura") &&
    lowerHeader.includes("municipio") &&
    lowerHeader.includes("votos");

  const isPivotFormat =
    lowerHeader[0] === "municipio" &&
    header.length > 1;

  if (isLongFormat) {
    return parseLongDataset([header, ...rows.slice(1)], fileName);
  }

  if (isPivotFormat) {
    return parsePivotDataset([header, ...rows.slice(1)], fileName);
  }

  throw new Error(
    "Formato não reconhecido. Use o CSV pivotado por município ou o CSV com colunas Candidatura, Municipio e Votos."
  );
};

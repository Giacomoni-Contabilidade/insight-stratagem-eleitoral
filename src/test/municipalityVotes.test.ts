import { describe, expect, it } from "vitest";
import {
  normalizeMunicipalityName,
  parseMunicipalityVotesCsv,
} from "@/lib/municipalityVotes";

describe("municipalityVotes", () => {
  it("parses pivot csv files", () => {
    const csv = [
      "Municipio,ERIKA HILTON,GUILHERME BOULOS",
      "SÃO PAULO,100,200",
      "Aparecida d'Oeste,10,12",
    ].join("\n");

    const parsed = parseMunicipalityVotesCsv(csv, "pivot.csv");

    expect(parsed.format).toBe("pivot");
    expect(parsed.candidateOptions).toEqual(["ERIKA HILTON", "GUILHERME BOULOS"]);
    expect(parsed.candidateVotes["ERIKA HILTON"][normalizeMunicipalityName("SÃO PAULO")]).toBe(100);
    expect(parsed.candidateVotes["GUILHERME BOULOS"][normalizeMunicipalityName("Aparecida d'Oeste")]).toBe(12);
  });

  it("parses long csv files", () => {
    const csv = [
      "Candidatura,Partido,UF,Cargo,Municipio,Votos",
      "ERIKA HILTON,PSOL,SP,Deputado Federal,SÃO PAULO,100",
      "ERIKA HILTON,PSOL,SP,Deputado Federal,SÃO PAULO,25",
      "SÂMIA BOMFIM,PSOL,SP,Deputado Federal,CAMPINAS,80",
    ].join("\n");

    const parsed = parseMunicipalityVotesCsv(csv, "long.csv");

    expect(parsed.format).toBe("long");
    expect(parsed.candidateOptions).toEqual(["ERIKA HILTON", "SÂMIA BOMFIM"]);
    expect(parsed.candidateVotes["ERIKA HILTON"][normalizeMunicipalityName("São Paulo")]).toBe(125);
    expect(parsed.candidateVotes["SÂMIA BOMFIM"][normalizeMunicipalityName("Campinas")]).toBe(80);
  });

  it("normalizes municipality names with accents and punctuation", () => {
    expect(normalizeMunicipalityName("Aparecida d'Oeste")).toBe("APARECIDA D OESTE");
    expect(normalizeMunicipalityName("Estrela d'Oeste")).toBe("ESTRELA D OESTE");
    expect(normalizeMunicipalityName("São João da Boa Vista")).toBe("SAO JOAO DA BOA VISTA");
  });
});

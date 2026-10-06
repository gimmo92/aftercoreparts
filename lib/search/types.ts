export const SEARCH_STEPS = [
  { id: "analyze", label: "Analizzo la foto" },
  { id: "search", label: "Cerco online" },
  { id: "verify", label: "Verifico i risultati" },
] as const;

export type StepId = (typeof SEARCH_STEPS)[number]["id"];

export type Confidence = "alta" | "media" | "bassa";

export type CandidateOrigin = "lens" | "google_code" | "google_query" | "shopping";

export type Extraction = {
  tipo_componente: string;
  marca: string | null;
  codici: string[];
  caratteristiche_visibili: string;
  query_suggerite: string[];
};

export type Candidate = {
  title: string;
  url: string;
  source: string | null;
  snippet: string | null;
  thumbnailUrl: string | null;
  price: string | null;
  origin: CandidateOrigin;
};

export type VerifiedCandidate = Candidate & {
  pertinente: boolean;
  confidenza: Confidence;
  motivazione: string;
  vende_pezzo: boolean;
};

export type PublicResult = {
  title: string;
  url: string;
  source: string | null;
  snippet: string | null;
  thumbnailUrl: string | null;
  price: string | null;
  confidence: Confidence;
  reason: string;
  sellsPart: boolean;
};

export type PublicSearch = {
  id: string;
  cached: boolean;
  imageUrl: string | null;
  machineBrand: string | null;
  machineModel: string | null;
  recognition: {
    tipo_componente: string | null;
    marca: string | null;
    codici: string[];
    caratteristiche_visibili: string | null;
  };
  results: PublicResult[];
  reliable: boolean;
};

export type SearchEvent =
  | { type: "step"; id: StepId; label: string }
  | { type: "result"; data: PublicSearch }
  | { type: "error"; message: string };

export const PHOTO_TIPS = [
  "Inquadra la targhetta in modo che i codici siano nitidi e completi.",
  "Avvicinati e usa più luce: evita controluce e riflessi sul metallo.",
  "Se il codice è su un lato, fai la foto di quella faccia, non solo del pezzo intero.",
];

export const DISCLAIMER =
  "I link portano a siti terzi. Compatibilità e disponibilità vanno verificate con il venditore.";

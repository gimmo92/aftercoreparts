import type { Prisma } from "@prisma/client";
import { asStringArray } from "@/lib/format";
import type { PublicResult, PublicSearch } from "@/lib/search/types";

type ResultRow = {
  title: string;
  url: string;
  source: string | null;
  snippet: string | null;
  thumbnailUrl: string | null;
  price: string | null;
  confidence: string;
  reason: string;
  sellsPart: boolean;
};

export function toPublicSearch(input: {
  id: string;
  cached: boolean;
  imageUrl: string | null;
  imageDeletedAt: Date | null;
  machineBrand: string | null;
  machineModel: string | null;
  componentType: string | null;
  brand: string | null;
  codes: Prisma.JsonValue | string[];
  visibleFeatures: string | null;
  results: ResultRow[];
}): PublicSearch {
  const results: PublicResult[] = input.results.slice(0, 8).flatMap((result) => {
    if (result.confidence !== "alta" && result.confidence !== "media" && result.confidence !== "bassa") {
      return [];
    }
    return [
      {
        title: result.title,
        url: result.url,
        source: result.source,
        snippet: result.snippet,
        thumbnailUrl: result.thumbnailUrl,
        price: result.price,
        confidence: result.confidence,
        reason: result.reason,
        sellsPart: result.sellsPart,
      },
    ];
  });
  return {
    id: input.id,
    cached: input.cached,
    imageUrl: input.imageDeletedAt ? null : input.imageUrl,
    machineBrand: input.machineBrand,
    machineModel: input.machineModel,
    recognition: {
      tipo_componente: input.componentType,
      marca: input.brand,
      codici: asStringArray(input.codes),
      caratteristiche_visibili: input.visibleFeatures,
    },
    results,
    reliable: results.some((result) => result.confidence === "alta" || result.confidence === "media"),
  };
}

import { prisma } from "@/lib/db";
import { toPublicSearch } from "@/lib/search/present";

export async function loadPublicSearch(id: string) {
  const search = await prisma.search.findUnique({
    where: { id },
    include: { results: { orderBy: { position: "asc" } } },
  });
  if (!search || (search.status !== "completed" && search.status !== "cache_hit")) return null;

  if (search.cacheOfId && search.results.length === 0) {
    const source = await prisma.search.findUnique({
      where: { id: search.cacheOfId },
      include: { results: { orderBy: { position: "asc" } } },
    });
    if (!source) return null;
    return toPublicSearch({
      id: search.id,
      cached: true,
      imageUrl: source.imageUrl,
      imageDeletedAt: source.imageDeletedAt ?? search.imageDeletedAt,
      machineBrand: search.machineBrand,
      machineModel: search.machineModel,
      componentType: search.componentType ?? source.componentType,
      brand: search.brand ?? source.brand,
      codes: search.codes,
      visibleFeatures: search.visibleFeatures ?? source.visibleFeatures,
      results: source.results,
    });
  }

  return toPublicSearch({
    id: search.id,
    cached: search.status === "cache_hit",
    imageUrl: search.imageUrl,
    imageDeletedAt: search.imageDeletedAt,
    machineBrand: search.machineBrand,
    machineModel: search.machineModel,
    componentType: search.componentType,
    brand: search.brand,
    codes: search.codes,
    visibleFeatures: search.visibleFeatures,
    results: search.results,
  });
}

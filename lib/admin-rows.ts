import { prisma } from "@/lib/db";
import { asStringArray } from "@/lib/format";

export type AdminRow = {
  id: string;
  createdAt: Date;
  email: string;
  companyName: string;
  imageUrl: string | null;
  recognized: string;
  codes: string;
  highConfidence: number;
};

export async function listAdminRows(take: number): Promise<AdminRow[]> {
  const searches = await prisma.search.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      lead: true,
      results: true,
      cacheOf: { include: { results: true } },
    },
  });

  return searches.map((search) => {
    const source = search.cacheOf ?? search;
    const results = search.results.length > 0 ? search.results : (search.cacheOf?.results ?? []);
    const deleted = Boolean(search.imageDeletedAt || source.imageDeletedAt);
    const recognized = [source.componentType, source.brand].filter(Boolean).join(" · ");
    return {
      id: search.id,
      createdAt: search.createdAt,
      email: search.lead?.email ?? "",
      companyName: search.lead?.companyName ?? "",
      imageUrl: deleted ? null : source.imageUrl || null,
      recognized: recognized || "Non riconosciuto",
      codes: asStringArray(source.codes).join(", "),
      highConfidence: results.filter((result) => result.confidence === "alta").length,
    };
  });
}

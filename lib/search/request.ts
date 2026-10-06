import { readFileSync } from "node:fs";
import { del } from "@vercel/blob";
import { isBlobUrl } from "@/lib/urls";
import { clip } from "@/lib/format";
import { ImageError } from "@/lib/search/image";

const MAX_BYTES = 10 * 1024 * 1024;

export type IncomingSearch = {
  image: Buffer;
  tempBlobUrl: string | null;
  machineBrand: string | null;
  machineModel: string | null;
  notes: string | null;
  email: string;
  companyName: string;
  privacyConsent: boolean;
};

export async function readIncomingSearch(request: Request): Promise<IncomingSearch> {
  const form = await request.formData();
  const imageUrl = String(form.get("imageUrl") ?? "");
  const file = form.get("file");
  let image: Buffer | null = null;
  let tempBlobUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) throw new ImageError("L'immagine supera i 10 MB.");
    image = Buffer.from(await file.arrayBuffer());
  } else if (imageUrl) {
    if (!isBlobUrl(imageUrl)) throw new ImageError("URL immagine non consentito.");
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new ImageError("Impossibile scaricare la foto caricata.");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new ImageError("L'immagine supera i 10 MB.");
    image = Buffer.from(await response.arrayBuffer());
    tempBlobUrl = imageUrl;
    if (image.length > MAX_BYTES) {
      await del(imageUrl).catch(() => undefined);
      throw new ImageError("L'immagine supera i 10 MB.");
    }
  }

  if (!image) throw new ImageError("Manca la foto del ricambio.");

  return {
    image,
    tempBlobUrl,
    machineBrand: clip(String(form.get("machineBrand") ?? ""), 120),
    machineModel: clip(String(form.get("machineModel") ?? ""), 120),
    notes: clip(String(form.get("notes") ?? ""), 1000),
    email: String(form.get("email") ?? ""),
    companyName: String(form.get("companyName") ?? ""),
    privacyConsent: form.get("privacyConsent") === "true",
  };
}

export function readImageFile(path: string) {
  return readFileSync(path);
}

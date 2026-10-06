import { createHash } from "node:crypto";
import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024;

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

export type ImageKind = "jpeg" | "png" | "webp" | "heic";

export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, Math.min(buffer.length, 32)).toString("ascii").toLowerCase();
    if (brand.includes("avif")) return null;
    if (/heic|heix|hevc|hevx|mif1|msf1|heim|heis|heif/.test(brand)) return "heic";
  }
  return null;
}

export async function prepareImage(input: Buffer) {
  if (input.length === 0) {
    throw new ImageError("Manca la foto del ricambio.");
  }
  if (input.length > MAX_BYTES) {
    throw new ImageError("L'immagine supera i 10 MB.");
  }
  const kind = detectImageKind(input);
  if (!kind) {
    throw new ImageError("Formato non supportato. Usa JPEG, PNG, WEBP o HEIC.");
  }

  try {
    const jpeg = await sharp(input, { failOn: "none", pages: 1 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const hash = createHash("sha256").update(jpeg).digest("hex");
    return { jpeg, hash };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "image_prepare_failed",
        kind,
        message: error instanceof Error ? error.message : "errore",
      }),
    );
    if (kind === "heic") {
      throw new ImageError("Non riesco a leggere questo HEIC. Esporta la foto in JPEG e riprova.");
    }
    throw new ImageError("Non riesco a leggere questa foto. Prova con un JPEG più nitido.");
  }
}

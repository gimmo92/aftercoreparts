import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { leadFieldError, upsertLead } from "@/lib/leads";
import { hashIp } from "@/lib/format";
import { prepareImage } from "@/lib/search/image";
import { runSearch } from "@/lib/search/pipeline";

function loadEnvFile() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function flag(argv: string[], names: string[]) {
  for (let index = 0; index < argv.length; index += 1) {
    if (names.includes(argv[index] ?? "")) return argv[index + 1];
  }
  return undefined;
}

async function main() {
  loadEnvFile();
  const argv = process.argv.slice(2);
  const file = argv.find((arg) => !arg.startsWith("--"));
  if (!file) {
    console.error("Uso: npm run search -- foto.jpg --marca Still --modello RX20 --note \"filtro\"");
    process.exit(1);
  }

  const machineBrand = flag(argv, ["--marca", "--brand"]) ?? null;
  const machineModel = flag(argv, ["--modello", "--model"]) ?? null;
  const notes = flag(argv, ["--note", "--notes"]) ?? null;
  const email = flag(argv, ["--email"]) ?? "";
  const companyName = flag(argv, ["--azienda", "--company"]) ?? "";
  const prepared = await prepareImage(readFileSync(resolve(file)));

  let lead: { id: string; email: string; companyName: string; consentAt: Date } | null = null;
  if (email || companyName) {
    const error = leadFieldError({ email, companyName, privacyConsent: true });
    if (error) {
      console.error(error);
      process.exit(1);
    }
    const saved = await upsertLead({ email, companyName });
    lead = {
      id: saved.id,
      email: saved.email,
      companyName: saved.companyName,
      consentAt: saved.consentAt,
    };
  }

  for await (const event of runSearch({
    jpeg: prepared.jpeg,
    hash: prepared.hash,
    tempBlobUrl: null,
    machineBrand,
    machineModel,
    notes,
    ipHash: hashIp("cli"),
    lead,
  })) {
    if (event.type === "step") {
      console.log(event.label);
      continue;
    }
    if (event.type === "error") {
      console.error(event.message);
      process.exit(1);
    }
    const data = event.data;
    console.log("");
    console.log(`Tipo: ${data.recognition.tipo_componente ?? "—"}`);
    console.log(`Marca: ${data.recognition.marca ?? "—"}`);
    console.log(`Codici: ${data.recognition.codici.join(", ") || "nessuno"}`);
    console.log(`Risultati: ${data.results.length}${data.cached ? " (cache)" : ""}`);
    for (const result of data.results) {
      console.log(`- [${result.confidence}] ${result.title} — ${result.url}`);
    }
    console.log("");
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

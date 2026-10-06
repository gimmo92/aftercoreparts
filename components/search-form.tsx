"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startSearch } from "@/components/search-job";

type Quota = {
  requiresLead: boolean;
  capped: boolean;
  message: string | null;
};

export function SearchForm() {
  const router = useRouter();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quota")
      .then(async (response) => {
        const data = (await response.json()) as Quota & { message?: string };
        if (!response.ok) throw new Error(data.message || "Servizio non disponibile.");
        if (!cancelled) setQuota(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setQuotaError(reason instanceof Error ? reason.message : "Servizio non disponibile.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  function takeFile(next: File | null) {
    setError(null);
    setFile(next);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const url = next ? URL.createObjectURL(next) : null;
    previewUrl.current = url;
    setPreview(url);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || starting) return;
    const form = new FormData(event.currentTarget);
    const requiresLead = quota?.requiresLead ?? false;
    const email = String(form.get("email") ?? "");
    const companyName = String(form.get("companyName") ?? "");
    const privacyConsent = form.get("privacyConsent") === "on";
    if (requiresLead && (!email.trim() || !companyName.trim() || !privacyConsent)) {
      setError("Per continuare servono email aziendale, nome azienda e consenso privacy.");
      return;
    }
    setStarting(true);
    startSearch({
      file,
      machineBrand: String(form.get("machineBrand") ?? ""),
      machineModel: String(form.get("machineModel") ?? ""),
      notes: String(form.get("notes") ?? ""),
      email: requiresLead ? email : "",
      companyName: requiresLead ? companyName : "",
      privacyConsent: requiresLead && privacyConsent,
    });
    router.push("/ricerca");
  }

  const capped = quota?.capped ?? false;

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div
        className={`rounded-2xl border-2 border-dashed bg-card px-4 py-6 text-center ${dragOver ? "border-orange" : "border-ink/20"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          takeFile(event.dataTransfer.files[0] ?? null);
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Anteprima del ricambio" className="mx-auto mb-4 max-h-56 rounded-xl object-contain" />
        ) : (
          <p className="text-base leading-6">Trascina qui la foto del pezzo o della targhetta.</p>
        )}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="h-12 flex-1 rounded-xl border border-ink/15 bg-white font-semibold"
            onClick={() => galleryRef.current?.click()}
          >
            Scegli foto
          </button>
          <button
            type="button"
            className="h-12 flex-1 rounded-xl bg-ink font-semibold text-white"
            onClick={() => cameraRef.current?.click()}
          >
            Scatta foto
          </button>
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="hidden"
          onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <label className="block text-sm font-medium">
        Marca della macchina
        <input name="machineBrand" className="mt-1 h-12 w-full rounded-xl border border-ink/15 bg-white px-3" placeholder="Opzionale, es. Still" />
      </label>
      <label className="block text-sm font-medium">
        Modello
        <input name="machineModel" className="mt-1 h-12 w-full rounded-xl border border-ink/15 bg-white px-3" placeholder="Opzionale, es. RX20" />
      </label>
      <label className="block text-sm font-medium">
        Note
        <textarea
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-3"
          placeholder="Opzionale, es. pompa lato destro"
        />
      </label>

      {quota?.requiresLead ? (
        <fieldset className="space-y-4 rounded-2xl border border-ink/10 bg-card p-4">
          <legend className="px-1 text-sm font-semibold">Dalla seconda ricerca</legend>
          <p className="text-sm leading-5 text-ink/70">Servono un&apos;email aziendale e il nome dell&apos;azienda. La prima ricerca resta gratuita.</p>
          <label className="block text-sm font-medium">
            Email aziendale
            <input name="email" type="email" required className="mt-1 h-12 w-full rounded-xl border border-ink/15 bg-white px-3" />
          </label>
          <label className="block text-sm font-medium">
            Azienda
            <input name="companyName" required className="mt-1 h-12 w-full rounded-xl border border-ink/15 bg-white px-3" />
          </label>
          <label className="flex items-start gap-3 text-sm leading-5">
            <input name="privacyConsent" type="checkbox" required className="mt-1 h-5 w-5" />
            <span>
              Acconsento al trattamento dei dati per essere ricontattato.{" "}
              <Link href="/privacy" className="underline underline-offset-4">
                Informativa privacy
              </Link>
            </span>
          </label>
        </fieldset>
      ) : (
        <p className="text-sm text-ink/70">La prima ricerca è gratuita e non chiede la registrazione.</p>
      )}

      {quota?.message ? <p className="rounded-xl bg-white px-3 py-3 text-sm">{quota.message}</p> : null}
      {quotaError ? <p className="text-sm text-orange">{quotaError}</p> : null}
      {error ? <p className="text-sm text-orange">{error}</p> : null}

      <button
        type="submit"
        disabled={!file || capped || starting || (!quota && !quotaError)}
        className="h-12 w-full rounded-xl bg-orange font-semibold text-white disabled:opacity-50"
      >
        {starting ? "Avvio..." : "Cerca il ricambio"}
      </button>
    </form>
  );
}

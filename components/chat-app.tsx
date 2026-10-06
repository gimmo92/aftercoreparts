"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { runSearchJob } from "@/components/search-job";
import { DISCLAIMER, PHOTO_TIPS, type PublicResult, type PublicSearch } from "@/lib/search/types";
import { siteLabel } from "@/lib/urls";

type Quota = {
  requiresLead: boolean;
  capped: boolean;
  message: string | null;
};

type Attachment = {
  id: string;
  file: File;
  preview: string;
};

type UserMessage = {
  id: string;
  role: "user";
  text: string;
  images: string[];
};

type AssistantText = {
  id: string;
  role: "assistant";
  kind: "text";
  text: string;
};

type AssistantSearch = {
  id: string;
  role: "assistant";
  kind: "search";
  status: "running" | "done" | "error";
  step: string;
  result?: PublicSearch;
  error?: string;
};

type ChatMessage = UserMessage | AssistantText | AssistantSearch;

const WELCOME =
  "Mandami la foto del pezzo o della targhetta. Se conosci marca, modello o dove è montato, scrivilo qui: uso tutto insieme alla foto.";

const BADGE: Record<PublicResult["confidence"], string> = {
  alta: "bg-emerald-700 text-white",
  media: "bg-amber-600 text-white",
  bassa: "bg-ink/70 text-white",
};

function newId() {
  return crypto.randomUUID();
}

export function ChatApp({ calendarUrl }: { calendarUrl: string }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", kind: "text", text: WELCOME },
  ]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [context, setContext] = useState<string[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PublicResult | null>(null);

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
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, attachments, busy]);

  function addFiles(list: FileList | File[]) {
    const next = [...list].filter((file) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name));
    if (next.length === 0) return;
    setAttachments((current) => {
      const room = Math.max(0, 4 - current.length);
      const added = next.slice(0, room).map((file) => ({
        id: newId(),
        file,
        preview: URL.createObjectURL(file),
      }));
      return [...current, ...added];
    });
    setFormError(null);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  }

  async function refreshQuota() {
    const response = await fetch("/api/quota");
    if (!response.ok) return;
    setQuota((await response.json()) as Quota);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (busy) return;
    if (!text && attachments.length === 0) return;
    if (quota?.capped && attachments.length > 0) return;

    if (attachments.length === 0) {
      setMessages((current) => [
        ...current,
        { id: newId(), role: "user", text, images: [] },
        {
          id: newId(),
          role: "assistant",
          kind: "text",
          text: "Annotato. Allega la foto del pezzo o della targhetta quando vuoi: più è nitida, meglio confronto le immagini.",
        },
      ]);
      setContext((current) => [...current, text]);
      setDraft("");
      return;
    }

    if (quota?.requiresLead && (!email.trim() || !companyName.trim() || !privacyConsent)) {
      setFormError("Per una nuova ricerca servono email aziendale, nome azienda e consenso privacy.");
      return;
    }

    const photos = attachments.map((item) => item.preview);
    const files = attachments.map((item) => item.file);
    const primary = files[0];
    if (!primary) return;
    const notes = [...context, text].filter(Boolean).join("\n");
    const searchId = newId();
    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", text, images: photos },
      { id: searchId, role: "assistant", kind: "search", status: "running", step: "Analizzo la foto" },
    ]);
    setContext((current) => (text ? [...current, text] : current));
    setDraft("");
    setAttachments([]);
    setBusy(true);
    setFormError(null);

    try {
      const result = await runSearchJob(
        {
          file: primary,
          machineBrand: "",
          machineModel: "",
          notes: files.length > 1 ? `${notes}\nFoto allegate nello stesso messaggio: ${files.length}.`.trim() : notes,
          email: quota?.requiresLead ? email : "",
          companyName: quota?.requiresLead ? companyName : "",
          privacyConsent: Boolean(quota?.requiresLead && privacyConsent),
        },
        (step) => {
          setMessages((current) =>
            current.map((message) =>
              message.role === "assistant" && message.kind === "search" && message.id === searchId
                ? { ...message, step }
                : message,
            ),
          );
        },
      );
      setMessages((current) =>
        current.map((message) =>
          message.role === "assistant" && message.kind === "search" && message.id === searchId
            ? { ...message, status: "done", step: "Fatto", result }
            : message,
        ),
      );
      await refreshQuota();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ricerca non riuscita.";
      setMessages((current) =>
        current.map((item) =>
          item.role === "assistant" && item.kind === "search" && item.id === searchId
            ? { ...item, status: "error", error: message }
            : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col">
      <div className="flex-1 space-y-3 px-4 py-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} calendarUrl={calendarUrl} onSelect={setSelected} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 shrink-0 border-t border-ink/10 bg-paper px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
        }}
      >
        {quota?.requiresLead ? (
          <div className="mb-3 space-y-2 rounded-2xl border border-ink/10 bg-card p-3">
            <p className="text-sm leading-5">Dalla seconda ricerca servono email aziendale e nome azienda.</p>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="Email aziendale"
              className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3"
            />
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Azienda"
              className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3"
            />
            <label className="flex items-start gap-2 text-sm leading-5">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(event) => setPrivacyConsent(event.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span>
                Acconsento al trattamento dei dati.{" "}
                <Link href="/privacy" className="underline underline-offset-4">
                  Privacy
                </Link>
              </span>
            </label>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachment.preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
                <button
                  type="button"
                  aria-label="Rimuovi foto"
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {quota?.message ? <p className="mb-2 text-sm">{quota.message}</p> : null}
        {quotaError ? <p className="mb-2 text-sm text-orange">{quotaError}</p> : null}
        {formError ? <p className="mb-2 text-sm text-orange">{formError}</p> : null}

        <div className="flex items-end gap-2">
          <button
            type="button"
            aria-label="Scatta foto"
            onClick={() => cameraRef.current?.click()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white"
          >
            <CameraIcon />
          </button>
          <button
            type="button"
            aria-label="Allega foto"
            onClick={() => galleryRef.current?.click()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white"
          >
            <ImageIcon />
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            placeholder="Scrivi marca, modello o un dettaglio"
            className="max-h-28 min-h-12 flex-1 resize-none rounded-2xl border border-ink/15 bg-white px-3 py-3"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={
              busy ||
              (!draft.trim() && attachments.length === 0) ||
              (attachments.length > 0 && Boolean(quota?.capped)) ||
              (attachments.length > 0 && !quota && !quotaError)
            }
            className="h-12 shrink-0 rounded-full bg-orange px-4 font-semibold text-white disabled:opacity-50"
          >
            Invia
          </button>
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </form>

      {selected ? <PhotoSheet result={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function MessageBubble({
  message,
  calendarUrl,
  onSelect,
}: {
  message: ChatMessage;
  calendarUrl: string;
  onSelect: (result: PublicResult) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="ml-10 flex flex-col items-end gap-2">
        {message.images.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {message.images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="Foto inviata" className="h-28 w-28 rounded-2xl object-cover" />
            ))}
          </div>
        ) : null}
        {message.text ? <p className="max-w-[85%] rounded-2xl bg-ink px-3 py-2 text-white">{message.text}</p> : null}
      </div>
    );
  }

  if (message.kind === "text") {
    return <p className="mr-8 max-w-[90%] rounded-2xl bg-card px-3 py-3 leading-6 shadow-sm">{message.text}</p>;
  }

  if (message.status === "running") {
    return (
      <p className="mr-8 max-w-[90%] rounded-2xl bg-card px-3 py-3 leading-6 shadow-sm">
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-orange" />
        {message.step}
      </p>
    );
  }

  if (message.status === "error") {
    return <p className="mr-8 max-w-[90%] rounded-2xl border border-orange/40 bg-white px-3 py-3">{message.error}</p>;
  }

  const result = message.result;
  if (!result) return null;
  const photos = result.results.filter((item) => item.thumbnailUrl);
  const withoutPhoto = result.results.filter((item) => !item.thumbnailUrl);

  return (
    <div className="mr-4 space-y-3 rounded-2xl bg-card p-3 shadow-sm">
      <p className="text-sm leading-6">
        {result.recognition.tipo_componente || "Componente"}
        {result.recognition.marca ? ` · ${result.recognition.marca}` : ""}
        {result.recognition.codici.length > 0 ? ` · ${result.recognition.codici.join(", ")}` : ""}
      </p>
      {!result.reliable ? (
        <div className="rounded-xl border border-orange/30 bg-white p-3 text-sm leading-6">
          <p>Non ho trovato foto abbastanza sicure. Rifai lo scatto così:</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {PHOTO_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm leading-6">Queste sono le foto più plausibili. Tocca una per aprire la scheda.</p>
      )}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((item) => (
            <button
              key={item.url}
              type="button"
              onClick={() => onSelect(item)}
              className="overflow-hidden rounded-xl border border-ink/10 bg-white text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnailUrl ?? ""} alt="" className="aspect-square w-full object-cover" />
              <span className="flex items-center justify-between gap-2 px-2 py-2">
                <span className="truncate text-xs">{siteLabel(item.url, item.source)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${BADGE[item.confidence]}`}>
                  {item.confidence}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {!result.reliable && photos.length > 0 ? <p className="text-xs text-ink/60">Corrispondenze deboli</p> : null}
      {withoutPhoto.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {withoutPhoto.map((item) => (
            <li key={item.url}>
              <button type="button" onClick={() => onSelect(item)} className="text-left underline underline-offset-4">
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs leading-5 text-ink/60">{DISCLAIMER}</p>
      {calendarUrl ? (
        <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-semibold text-orange">
          Vuoi la ricerca per foto sul tuo magazzino? Parla con Aftercore
        </a>
      ) : null}
    </div>
  );
}

function PhotoSheet({ result, onClose }: { result: PublicResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/50 p-3" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-card p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {result.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.thumbnailUrl} alt="" className="max-h-72 w-full rounded-2xl object-contain" />
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${BADGE[result.confidence]}`}>
            {result.confidence}
          </span>
          <span className="text-sm text-ink/60">{result.sellsPart ? "Sembra in vendita" : "Pagina informativa"}</span>
        </div>
        <p className="mt-2 font-semibold leading-5">{result.title}</p>
        <p className="mt-1 text-sm text-ink/60">{siteLabel(result.url, result.source)}</p>
        {result.price ? <p className="mt-1 text-sm font-semibold">{result.price}</p> : null}
        <p className="mt-2 text-sm leading-5">{result.reason}</p>
        <div className="mt-4 flex gap-3">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-orange font-semibold text-white"
          >
            Apri scheda
          </a>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-ink/15 px-4 font-semibold">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 7.5 9.2 5.5h5.6L16 7.5h2.5A1.5 1.5 0 0 1 20 9v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V9a1.5 1.5 0 0 1 1.5-1.5H8Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path d="m7 16 3.2-3.2a1 1 0 0 1 1.4 0L16 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

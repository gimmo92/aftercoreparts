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

type ChatImage = {
  src: string;
  name: string;
};

type UserMessage = {
  id: string;
  role: "user";
  text: string;
  images: ChatImage[];
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
  alta: "bg-emerald-50 text-emerald-700",
  media: "bg-amber-50 text-amber-700",
  bassa: "bg-paper text-muted",
};

function newId() {
  return crypto.randomUUID();
}

const WELCOME_MESSAGE: AssistantText = { id: "welcome", role: "assistant", kind: "text", text: WELCOME };

export function ChatApp({ calendarUrl }: { calendarUrl: string }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
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

  function resetConversation() {
    if (busy) return;
    setAttachments((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.preview));
      return [];
    });
    setMessages((current) => {
      for (const message of current) {
        if (message.role === "user") {
          for (const image of message.images) URL.revokeObjectURL(image.src);
        }
      }
      return [WELCOME_MESSAGE];
    });
    setDraft("");
    setContext([]);
    setFormError(null);
    setSelected(null);
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

    const photos = attachments.map((item) => ({ src: item.preview, name: item.file.name }));
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

  const thread = threadSummary(messages);
  const latest = latestSearch(messages);

  return (
    <div className="flex h-full min-h-0 flex-1 bg-paper">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-paper md:flex">
        <div className="px-4 pt-4 pb-3">
          <p className="text-sm font-semibold">Conversazioni</p>
          <p className="mt-0.5 text-xs text-muted">Questa sessione</p>
          <button
            type="button"
            onClick={resetConversation}
            disabled={busy}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-medium disabled:opacity-50"
          >
            <PlusIcon />
            Nuova conversazione
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {thread ? (
            <div className="rounded-xl bg-soft px-3 py-2.5">
              <p className="truncate text-sm font-medium">{thread.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{thread.preview}</p>
            </div>
          ) : (
            <p className="px-2 text-xs leading-5 text-muted">Le ricerche di questa sessione compaiono qui.</p>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-soft text-blue">
              <ChatGlyph />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-none">Trova ricambio</p>
              <p className="mt-1 truncate text-xs text-muted">Foto, codici e schede</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetConversation}
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium disabled:opacity-50"
          >
            <PlusIcon />
            <span className="hidden sm:inline">Nuova conversazione</span>
            <span className="sm:hidden">Nuova</span>
          </button>
        </div>

        <div className="chat-canvas min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} calendarUrl={calendarUrl} onSelect={setSelected} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
          }}
        >
          <div className="mx-auto w-full max-w-3xl">
            {quota?.requiresLead ? (
              <div className="mb-3 space-y-2 rounded-2xl border border-line bg-white p-3 shadow-sm">
                <p className="text-sm leading-5">Dalla seconda ricerca servono email aziendale e nome azienda.</p>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="Email aziendale"
                  className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-blue"
                />
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Azienda"
                  className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-blue"
                />
                <label className="flex items-start gap-2 text-sm leading-5">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(event) => setPrivacyConsent(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-blue"
                  />
                  <span>
                    Acconsento al trattamento dei dati.{" "}
                    <Link href="/privacy" className="font-medium text-blue">
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

            {quota?.message ? <p className="mb-2 text-sm text-muted">{quota.message}</p> : null}
            {quotaError ? <p className="mb-2 text-sm text-red-600">{quotaError}</p> : null}
            {formError ? <p className="mb-2 text-sm text-red-600">{formError}</p> : null}

            <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm">
              <button
                type="button"
                aria-label="Allega foto"
                onClick={() => galleryRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-paper"
              >
                <PaperclipIcon />
              </button>
              <button
                type="button"
                aria-label="Scatta foto"
                onClick={() => cameraRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-paper"
              >
                <CameraIcon />
              </button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={1}
                placeholder="Descrivi il pezzo, la marca o allega una foto del componente..."
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted"
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
                className="h-10 shrink-0 rounded-xl bg-blue px-4 text-sm font-semibold text-white disabled:opacity-40"
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
          </div>
        </form>
      </section>

      <ResultsPanel search={latest} onSelect={setSelected} />

      {selected ? <PhotoSheet result={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function threadSummary(messages: ChatMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser || firstUser.role !== "user") return null;
  const title =
    firstUser.text || (firstUser.images[0] ? `Allegato: ${firstUser.images[0].name}` : "Foto ricambio");
  let preview = "Conversazione aperta";
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "assistant") continue;
    if (message.kind === "text") {
      preview = message.text;
      break;
    }
    if (message.status === "running") preview = message.step;
    else if (message.status === "error") preview = message.error || "Ricerca non riuscita";
    else preview = message.result?.recognition.tipo_componente || "Risultati pronti";
    break;
  }
  return { title, preview };
}

function latestSearch(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && message.role === "assistant" && message.kind === "search") return message;
  }
  return null;
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
      <div className="ml-12 flex flex-col items-end gap-2">
        {message.images.map((image) => (
          <div key={image.src} className="flex flex-col items-end gap-2">
            <p className="max-w-full truncate rounded-2xl rounded-br-md bg-blue px-3.5 py-2 text-sm text-white">
              Allegato: {image.name}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt="Foto inviata" className="h-28 w-28 rounded-2xl object-cover" />
          </div>
        ))}
        {message.text ? (
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-blue px-3.5 py-2.5 text-sm leading-6 text-white">
            {message.text}
          </p>
        ) : null}
      </div>
    );
  }

  if (message.kind === "text") {
    return (
      <div className="mr-10 max-w-[42rem] rounded-2xl rounded-bl-md bg-[#eef1f4] px-4 py-3.5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">ASSISTENTE</p>
        <p className="mt-2 text-sm leading-6">{message.text}</p>
      </div>
    );
  }

  if (message.status === "running") {
    return (
      <div className="mr-10 max-w-[42rem] rounded-2xl rounded-bl-md bg-[#eef1f4] px-4 py-3.5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">ASSISTENTE</p>
        <p className="mt-2 text-sm leading-6">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
          {message.step}
        </p>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="mr-10 max-w-[42rem] rounded-2xl border border-red-200 bg-white px-4 py-3.5 text-sm text-red-700">
        {message.error}
      </div>
    );
  }

  const result = message.result;
  if (!result) return null;
  const photos = result.results.filter((item) => item.thumbnailUrl);
  const withoutPhoto = result.results.filter((item) => !item.thumbnailUrl);
  const tipo = result.recognition.tipo_componente || "Componente";
  const marca = result.recognition.marca ? `, marca ${result.recognition.marca}` : "";
  const codici =
    result.recognition.codici.length > 0 ? ` Codici letti: ${result.recognition.codici.join(", ")}.` : "";

  return (
    <div className="mr-10 max-w-[42rem] rounded-2xl rounded-bl-md bg-[#eef1f4] px-4 py-3.5">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">ASSISTENTE</p>
      <div className="mt-2 space-y-3 text-sm leading-6">
        <p>
          Ho identificato il componente: {tipo}
          {marca ? ` (${result.recognition.marca})` : ""}.{codici}
        </p>
        {!result.reliable ? (
          <div>
            <p>Non ho trovato foto abbastanza sicure. Rifai lo scatto così:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {PHOTO_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>
            Ho trovato {result.results.length === 1 ? "una scheda vicina" : `${result.results.length} schede vicine`}.
            <span className="hidden lg:inline"> Prezzo, fonte e confidenza sono nel pannello Risultati.</span>
          </p>
        )}
      </div>
      {result.results.length > 0 ? (
        <div className="mt-3 space-y-2 lg:hidden">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="overflow-hidden rounded-xl border border-line bg-white text-left"
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
          {withoutPhoto.length > 0 ? (
            <ul className="space-y-2">
              {withoutPhoto.map((item) => (
                <li key={item.url}>
                  <button type="button" onClick={() => onSelect(item)} className="text-left text-sm font-medium text-blue">
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-muted">{DISCLAIMER}</p>
      {calendarUrl ? (
        <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-sm font-medium text-blue">
          Vuoi la ricerca per foto sul tuo magazzino? Parla con Aftercore
        </a>
      ) : null}
    </div>
  );
}

function ResultsPanel({
  search,
  onSelect,
}: {
  search: AssistantSearch | null;
  onSelect: (result: PublicResult) => void;
}) {
  const results = search?.status === "done" ? (search.result?.results ?? []) : [];
  return (
    <aside className="hidden w-[22rem] shrink-0 flex-col border-l border-line bg-white lg:flex">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Risultati</p>
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blue px-1.5 text-[11px] font-semibold text-white">
            {results.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">Schede trovate online</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {search?.status === "running" ? (
          <p className="px-4 py-4 text-sm text-muted">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
            {search.step}
          </p>
        ) : null}
        {search?.status === "error" ? <p className="px-4 py-4 text-sm text-red-600">{search.error}</p> : null}
        {search?.status === "done" && results.length > 0 ? (
          <div>
            <p className="px-4 pt-4 text-[11px] font-semibold tracking-[0.14em] text-muted">RICAMBI IDENTIFICATI</p>
            <ul>
              {results.map((item) => (
                <li key={item.url} className="border-b border-line">
                  <button type="button" onClick={() => onSelect(item)} className="block w-full px-4 py-4 text-left hover:bg-paper">
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-start gap-2">
                        <PartMark />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-blue">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted">{siteLabel(item.url, item.source)}</span>
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[item.confidence]}`}>
                        {item.confidence === "alta" ? "Alta" : item.confidence === "media" ? "Media" : "Bassa"}
                      </span>
                    </span>
                    <Field label="Descrizione" value={item.reason || item.snippet || item.title} />
                    <Field label="Prezzo" value={item.price || "—"} />
                    <Field label="Fonte" value={item.sellsPart ? "Sembra in vendita" : "Pagina informativa"} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!search || (search.status === "done" && results.length === 0) ? (
          <p className="px-4 py-4 text-sm leading-6 text-muted">I ricambi compaiono qui dopo la foto.</p>
        ) : null}
      </div>
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="mt-3 block">
      <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</span>
      <span className="mt-1 block text-sm leading-5">{value}</span>
    </span>
  );
}

function PhotoSheet({ result, onClose }: { result: PublicResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        {result.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.thumbnailUrl} alt="" className="max-h-72 w-full rounded-xl bg-paper object-contain" />
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${BADGE[result.confidence]}`}>
            {result.confidence}
          </span>
          <span className="text-sm text-muted">{result.sellsPart ? "Sembra in vendita" : "Pagina informativa"}</span>
        </div>
        <p className="mt-2 font-semibold leading-5">{result.title}</p>
        <p className="mt-1 text-sm text-muted">{siteLabel(result.url, result.source)}</p>
        {result.price ? <p className="mt-1 text-sm font-semibold">{result.price}</p> : null}
        <p className="mt-2 text-sm leading-5">{result.reason}</p>
        <div className="mt-4 flex gap-3">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-blue text-sm font-semibold text-white"
          >
            Apri scheda
          </a>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-line px-4 text-sm font-semibold">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function PartMark() {
  return (
    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-soft text-blue">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 2.5v2.2M8 11.3v2.2M2.5 8h2.2M11.3 8h2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChatGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.2h10v6.2a1 1 0 0 1-1 1H6.2L3.4 13.6V4.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 7.5 9.2 5.5h5.6L16 7.5h2.5A1.5 1.5 0 0 1 20 9v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V9a1.5 1.5 0 0 1 1.5-1.5H8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 12.5 14 7a3 3 0 0 1 4.2 4.2l-7.1 7.1a4.5 4.5 0 0 1-6.4-6.4l6.4-6.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

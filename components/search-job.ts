"use client";

import { upload } from "@vercel/blob/client";
import { SEARCH_STEPS, type PublicSearch, type SearchEvent } from "@/lib/search/types";

const FOUR_MB = 4 * 1024 * 1024;

export type PendingSearch = {
  file: File;
  machineBrand: string;
  machineModel: string;
  notes: string;
  email: string;
  companyName: string;
  privacyConsent: boolean;
};

type StepStatus = "pending" | "active" | "done";

export type JobSnapshot = {
  phase: "idle" | "running" | "error" | "done";
  steps: { id: string; label: string; status: StepStatus }[];
  error: string | null;
  resultId: string | null;
};

const listeners = new Set<() => void>();

let snapshot: JobSnapshot = idleSnapshot();

function idleSnapshot(): JobSnapshot {
  return {
    phase: "idle",
    steps: SEARCH_STEPS.map((step) => ({ id: step.id, label: step.label, status: "pending" })),
    error: null,
    resultId: null,
  };
}

function emit(next: JobSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function getSearchSnapshot() {
  return snapshot;
}

export function subscribeSearch(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function stepsAt(activeId: string | null, done: boolean): JobSnapshot["steps"] {
  const activeIndex = SEARCH_STEPS.findIndex((step) => step.id === activeId);
  return SEARCH_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: done || (activeIndex >= 0 && index < activeIndex) ? "done" : index === activeIndex ? "active" : "pending",
  }));
}

function isHeic(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

function compressImage(file: File) {
  return new Promise<File | null>((resolve) => {
    if (!file.type.startsWith("image/") || isHeic(file)) {
      resolve(null);
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ? new File([blob], "ricambio.jpg", { type: "image/jpeg" }) : null);
        },
        "image/jpeg",
        0.85,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

async function fileForUpload(file: File) {
  if (!isHeic(file)) {
    const compressed = await compressImage(file);
    if (compressed && compressed.size <= FOUR_MB) return { file: compressed };
    if (file.size <= FOUR_MB) return { file };
  }
  const blob = await upload(file.name || "ricambio.jpg", file, {
    access: "public",
    handleUploadUrl: "/api/blob",
  });
  return { imageUrl: blob.url };
}

function formData(pending: PendingSearch, image: { file?: File; imageUrl?: string }) {
  const form = new FormData();
  if (image.file) form.set("file", image.file);
  if (image.imageUrl) form.set("imageUrl", image.imageUrl);
  form.set("machineBrand", pending.machineBrand);
  form.set("machineModel", pending.machineModel);
  form.set("notes", pending.notes);
  form.set("email", pending.email);
  form.set("companyName", pending.companyName);
  form.set("privacyConsent", pending.privacyConsent ? "true" : "false");
  return form;
}

async function readEvents(response: Response, onEvent: (event: SearchEvent) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Risposta incompleta.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as SearchEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as SearchEvent);
}

export async function runSearchJob(pending: PendingSearch, onStep?: (label: string) => void) {
  const image = await fileForUpload(pending.file);
  const response = await fetch("/api/search", { method: "POST", body: formData(pending, image) });
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { message?: string };
    throw new Error(data.message || "Ricerca non riuscita.");
  }
  if (!response.ok) throw new Error("Ricerca non riuscita.");

  let result: PublicSearch | null = null;
  let streamError: string | null = null;
  await readEvents(response, (event) => {
    if (event.type === "step") {
      onStep?.(event.label);
      return;
    }
    if (event.type === "error") {
      streamError = event.message;
      return;
    }
    result = event.data;
  });
  if (streamError) throw new Error(streamError);
  if (!result) throw new Error("Risposta incompleta. Riprova.");
  return result;
}

export function startSearch(pending: PendingSearch) {
  if (snapshot.phase === "running") return;
  emit({
    phase: "running",
    steps: stepsAt("analyze", false),
    error: null,
    resultId: null,
  });
  void execute(pending);
}

async function execute(pending: PendingSearch) {
  try {
    const image = await fileForUpload(pending.file);
    const response = await fetch("/api/search", { method: "POST", body: formData(pending, image) });
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { message?: string };
      throw new Error(data.message || "Ricerca non riuscita.");
    }
    if (!response.ok) throw new Error("Ricerca non riuscita.");

    let resultId: string | null = null;
    let streamError: string | null = null;
    await readEvents(response, (event) => {
      if (event.type === "step") {
        emit({ ...snapshot, steps: stepsAt(event.id, false) });
        return;
      }
      if (event.type === "error") {
        streamError = event.message;
        return;
      }
      resultId = event.data.id;
    });
    if (streamError) throw new Error(streamError);
    if (!resultId) throw new Error("Risposta incompleta. Riprova.");
    emit({ phase: "done", steps: stepsAt(null, true), error: null, resultId });
  } catch (error) {
    emit({
      ...snapshot,
      phase: "error",
      error: error instanceof Error ? error.message : "Ricerca non riuscita.",
    });
  }
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSearchSnapshot, subscribeSearch, type JobSnapshot } from "@/components/search-job";

const pendingSteps: JobSnapshot["steps"] = [
  { id: "analyze", label: "Analizzo la foto", status: "pending" },
  { id: "search", label: "Cerco online", status: "pending" },
  { id: "verify", label: "Verifico i risultati", status: "pending" },
];

export default function SearchProgress() {
  const router = useRouter();
  const [state, setState] = useState<JobSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSearch(() => setState(getSearchSnapshot()));
    const timer = window.setTimeout(() => setState(getSearchSnapshot()), 0);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state?.phase === "done" && state.resultId) {
      router.replace(`/risultati/${state.resultId}`);
    }
  }, [router, state]);

  if (state?.phase === "idle") {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <h1 className="font-display text-4xl">Foto non disponibile</h1>
        <p className="mt-3 leading-6">La foto resta sul telefono solo per questa ricerca. Torna all&apos;inizio e scatta di nuovo.</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-orange px-5 font-semibold text-white">
          Nuova foto
        </Link>
      </div>
    );
  }

  const steps = state?.steps ?? pendingSteps;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="font-display text-4xl">Ricerca in corso</h1>
      <ol className="mt-8 space-y-4">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-card px-4 py-4">
            <span
              className={`h-3 w-3 rounded-full ${
                step.status === "done" ? "bg-emerald-700" : step.status === "active" ? "animate-pulse bg-orange" : "bg-ink/20"
              }`}
            />
            <span className={step.status === "pending" ? "text-ink/50" : "font-medium"}>{step.label}</span>
          </li>
        ))}
      </ol>
      {state?.error ? (
        <div className="mt-6 rounded-2xl border border-orange/40 bg-white px-4 py-4">
          <p>{state.error}</p>
          <Link href="/" className="mt-4 inline-flex h-12 items-center font-semibold text-orange">
            Torna all&apos;inizio
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink/60">Può volerci fino a un minuto.</p>
      )}
    </div>
  );
}

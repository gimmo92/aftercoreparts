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
      <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-lg px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Foto non disponibile</h1>
        <p className="mt-3 leading-6 text-muted">La foto resta sul telefono solo per questa ricerca. Torna all&apos;inizio e scatta di nuovo.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-blue px-5 text-sm font-semibold text-white">
          Nuova foto
        </Link>
      </div>
      </div>
    );
  }

  const steps = state?.steps ?? pendingSteps;

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-lg px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Ricerca in corso</h1>
      <ol className="mt-6 space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-4">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                step.status === "done" ? "bg-emerald-600" : step.status === "active" ? "animate-pulse bg-blue" : "bg-line"
              }`}
            />
            <span className={step.status === "pending" ? "text-muted" : "text-sm font-medium"}>{step.label}</span>
          </li>
        ))}
      </ol>
      {state?.error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-white px-4 py-4 text-sm">
          <p>{state.error}</p>
          <Link href="/" className="mt-4 inline-flex font-medium text-blue">
            Torna all&apos;inizio
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Può volerci fino a un minuto.</p>
      )}
    </div>
    </div>
  );
}

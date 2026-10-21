interface SetupStep {
  title: string;
  description: string;
}

interface SetupRequiredProps {
  title?: string;
  steps: SetupStep[];
  note?: string;
}

/** Panduan penyiapan first-run — tampil ketika environment/DB belum siap. */
export function SetupRequired({ title = "Penyiapan diperlukan", steps, note }: SetupRequiredProps) {
  return (
    <section
      className="rounded-xl border border-border bg-card p-6"
      aria-label="Langkah penyiapan"
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span
              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-xs font-semibold text-muted-foreground"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {note ? <p className="mt-4 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

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
      className="rounded-[var(--radius-card)] bg-card px-6 py-5"
      aria-label="Langkah penyiapan"
    >
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <ol className="mt-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-3 border-b border-rule py-3 last:border-b-0"
          >
            <span
              className="tnum mt-0.5 w-5 shrink-0 text-[11px] text-muted-foreground"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <p className="text-[13px] font-medium">{step.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {note ? <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{note}</p> : null}
    </section>
  );
}

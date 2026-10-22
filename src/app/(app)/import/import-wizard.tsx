"use client";

import { useActionState, useRef, useState } from "react";
import { CheckCircle2, Database, FileUp, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { commitImportAction, previewImportAction } from "./actions";
import { IMPORT_INITIAL_STATE } from "./import-state";
import type { ImportDataType } from "@/lib/csv/import";

export interface CompanyOption {
  ticker: string;
  name: string;
}

const PRICE_TEMPLATE = [
  "date,open,high,low,close,volume",
  "2026-01-02,10.00,11.00,9.00,10.50,1000",
  "2026-01-05,10.50,12.00,10.20,11.90,1200",
  "",
].join("\n");

const FUNDAMENTALS_TEMPLATE = [
  "period_end,statement_type,revenue,net_income,total_assets,operating_cash_flow,capex",
  "2025-12-31,income_statement,1.000,200,,,",
  "2025-12-31,balance_sheet,,,5.000,",
  "2025-12-31,cash_flow,,,,50,10",
  "",
].join("\n");

function templateHref(content: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;
}

const DATA_TYPES: Array<{ id: ImportDataType; label: string; hint: string }> = [
  { id: "prices", label: "Harga saham (OHLCV)", hint: "kolom: date, open, high, low, close, volume" },
  { id: "fundamentals", label: "Fondamen keuangan", hint: "kolom: period_end, statement_type (ops.), metrik apa adanya" },
];

export function ImportWizard({ companies }: { companies: CompanyOption[] }) {
  const [nonce, setNonce] = useState(0);
  return <WizardInner key={nonce} companies={companies} onReset={() => setNonce((value) => value + 1)} />;
}

function WizardInner({ companies, onReset }: { companies: CompanyOption[]; onReset: () => void }) {
  const [dataType, setDataType] = useState<ImportDataType>("prices");
  const [ticker, setTicker] = useState(companies[0]?.ticker ?? "");
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewState, previewDispatch, previewPending] = useActionState(
    previewImportAction,
    IMPORT_INITIAL_STATE,
  );
  const [commitState, commitDispatch, commitPending] = useActionState(
    commitImportAction,
    IMPORT_INITIAL_STATE,
  );

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsv(text);
      setFileName(file.name);
    };
    reader.onerror = () => {
      setFileError(`Gagal membaca file "${file.name}" — coba salin isinya ke kolom tempel manual.`);
    };
    reader.readAsText(file);
  };

  const preview = previewState.status === "preview" ? previewState.preview : null;
  const commit = commitState.status === "committed" ? commitState.committed : null;

  return (
    <div className="space-y-6">
      {commitState.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-card)] border-l-2 border-negative bg-[var(--pill-negative-bg)] px-3 py-2 text-xs text-[color:var(--pill-negative-ink)]">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {commitState.message}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>1 · Sumber data</CardTitle>
          <CardDescription>
            Pilih perusahaan (data dipisah per failure) dan tipe data; CSV dari file milik Anda
            atau tempel manual. Tidak ada scraper — aplikasi hanya membaca file yang Anda berikan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {companies.length === 0 ? (
            <p className="flex items-start gap-2 rounded-[var(--radius-card)] border-l-2 border-warning bg-[var(--pill-warning-bg)] px-3 py-2 text-xs text-[color:var(--pill-warning-ink)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Master perusahaan masih kosong — jalankan <code>npm run db:seed</code> terlebih
              dahulu, atau tambahkan preferen perusahaan lewat seed EDGAR.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {DATA_TYPES.map((option) => {
              const selected = dataType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDataType(option.id)}
                  aria-pressed={selected}
                  className={
                    "rounded-[var(--radius-card)] border px-4 py-3 text-left transition-colors " +
                    (selected
                      ? "border-control bg-raised/40"
                      : "border-border bg-transparent hover:border-control")
                  }
                >
                  <span
                    className={
                      selected
                        ? "rule-active inline-block text-[13px] font-medium text-foreground"
                        : "inline-block text-[13px] font-medium text-muted-foreground"
                    }
                  >
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="import-company" className="text-xs font-medium text-muted-foreground">
                Perusahaan
              </label>
              <select
                id="import-company"
                value={ticker}
                onChange={(event) => setTicker(event.target.value)}
                className="h-10 w-full rounded-[8px] border border-control bg-surface px-3 text-[13px] outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
              >
                {companies.map((company) => (
                  <option key={company.ticker} value={company.ticker}>
                    {company.ticker} — {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Template CSV</span>
              <div className="flex gap-2">
                <a
                  aria-label="Unduh template CSV harga"
                  href={templateHref(PRICE_TEMPLATE)}
                  download="stocklens-template-harga.csv"
                  className="inline-flex h-8 items-center rounded-[var(--radius-control)] border border-control px-3 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Harga
                </a>
                <a
                  aria-label="Unduh template CSV fondamen"
                  href={templateHref(FUNDAMENTALS_TEMPLATE)}
                  download="stocklens-template-fondamen.csv"
                  className="inline-flex h-8 items-center rounded-[var(--radius-control)] border border-control px-3 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Fondamen
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-[11px] text-muted-foreground">File CSV (.csv)</span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="sr-only"
              />
              <label
                htmlFor="import-file"
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-control px-3 text-[12px] text-foreground transition-colors hover:border-muted-foreground"
              >
                <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                Pilih file
              </label>
              <span className="text-[11px] text-muted-foreground">
                {fileName || "Belum ada file — atau tempel CSV di bawah"}
              </span>
            </div>
            {fileError ? <p className="text-xs text-negative">{fileError}</p> : null}
          </div>

          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={
              dataType === "prices"
                ? "date,open,high,low,close,volume\n2026-01-02,10,11,9,10.5,1000 ..."
                : "period_end,revenue,net_income,total_assets\n2026-12-31,1000,200,5000 ..."
            }
            className="tnum w-full rounded-[8px] border border-control bg-surface px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
          />

          <form action={previewDispatch} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="csv" value={csv} />
            <input type="hidden" name="dataType" value={dataType} />
            <input type="hidden" name="ticker" value={ticker} />
            <input type="hidden" name="fileName" value={fileName || "paste-manual.csv"} />
            <Button type="submit" disabled={previewPending || csv.trim() === ""}>
              <FileUp className="h-4 w-4" aria-hidden="true" />
              {previewPending ? "Memeriksa…" : "2 · Periksa CSV"}
            </Button>
            <span className="tnum text-[11px] text-muted-foreground">
              {csv.trim() === "" ? "Isi CSV terlebih dahulu" : `${csv.trim().split("\n").length} baris mentah terbaca di kolom`}
            </span>
          </form>
        </CardContent>
      </Card>

      {previewState.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-card)] border-l-2 border-negative bg-[var(--pill-negative-bg)] px-3 py-2 text-xs text-[color:var(--pill-negative-ink)]">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {previewState.message}
        </p>
      ) : null}

      {preview && previewState.status === "preview" ? (
        <Card>
          <CardHeader>
            <CardTitle>3 · Pratinjau &amp; konfirmasi</CardTitle>
            <CardDescription>
              {preview.fileName} — hasil parsing disintesis ulang saat konfirmasi (bukan status tersimpan).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant={preview.accepted > 0 ? "success" : "danger"}>
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {preview.accepted} baris siap impor
              </Badge>
              {preview.rejected > 0 ? (
                <Badge variant="danger">
                  <XCircle className="h-3 w-3" aria-hidden="true" />
                  {preview.rejected} baris ditolak
                </Badge>
              ) : null}
              {preview.duplicates > 0 ? <Badge variant="secondary">{preview.duplicates} duplikat</Badge> : null}
              <Badge variant="secondary">{preview.totalRows} baris di file</Badge>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Pemetaan kolom</p>
              <ul className="mt-1 space-y-1">
                {preview.mapping.map((entry) => (
                  <li key={`${entry.source}-${entry.target}`} className="text-xs">
                    <code className="rounded bg-muted px-1.5 py-0.5">{entry.source}</code>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className={entry.target.includes("tidak dikenal") ? "text-warning" : undefined}>
                      {entry.target}
                    </span>
                  </li>
                ))}
                {preview.ignoredColumns.map((column) => (
                  <li key={column} className="text-xs text-warning">
                    kolom <code className="rounded bg-muted px-1.5 py-0.5">{column}</code> diabaikan
                  </li>
                ))}
              </ul>
            </div>

            {preview.sample.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {preview.sample[0]?.map((cell) => (
                        <th key={cell.label} className="px-2 py-1.5 font-medium">
                          {cell.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {preview.sample.map((cells, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border/50">
                        {cells.map((cell) => (
                          <td key={cell.label} className="px-2 py-1.5">
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[11px] text-muted-foreground">maksimal 3 baris pertama yang lolos validasi</p>
              </div>
            ) : null}

            {preview.rejectionSamples.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Alasan penolakan (maks. 8)</p>
                <ul className="mt-1 space-y-0.5">
                  {preview.rejectionSamples.map((rejection) => (
                    <li key={`${rejection.line}-${rejection.reason}`} className="text-xs text-danger">
                      baris {rejection.line}: {rejection.reason}
                    </li>
                  ))}
                </ul>
                {preview.rejected > preview.rejectionSamples.length ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    … dan {preview.rejected - preview.rejectionSamples.length} penolakan lain.
                  </p>
                ) : null}
              </div>
            ) : null}

            <form action={commitDispatch} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="csv" value={csv} />
              <input type="hidden" name="dataType" value={dataType} />
              <input type="hidden" name="ticker" value={ticker} />
              <input type="hidden" name="fileName" value={fileName || "paste-manual.csv"} />
              <input type="hidden" name="confirm" value="1" />
              <Button type="submit" disabled={commitPending || preview.accepted === 0}>
                <Database className="h-4 w-4" aria-hidden="true" />
                {commitPending ? "Mengimpor…" : `Impor ${preview.accepted} baris`}
              </Button>
              {preview.accepted === 0 ? (
                <span className="text-xs text-muted-foreground">tidak ada baris yang dapat diimpor</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  menulis ke {dataType === "prices" ? "market_prices" : "financial_statements"} via riwayat
                  import_batches milik Anda
                </span>
              )}
            </form>
          </CardContent>
        </Card>
      ) : null}

      {commit && commitState.status === "committed" ? (
        <Card>
          <CardHeader>
            <CardTitle>Selesai</CardTitle>
            <CardDescription>Batch tersimpan dan dapat ditelusuri di riwayat import.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {commit.imported} baris dimpor ke {commit.companyName}
            </Badge>
            {commit.rejected > 0 ? <Badge variant="danger">{commit.rejected} ditolak</Badge> : null}
            <Button type="button" variant="ghost" onClick={onReset}>
              Impor file lain
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

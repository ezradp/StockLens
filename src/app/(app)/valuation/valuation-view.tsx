"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { computeDcf, sensitivityPerShare, type DcfInput } from "@/engine/dcf";
import type { DcfCompanyContext, ValuationScenario } from "@/server/dcf";
import { saveValuationScenarioAction, deleteValuationScenarioAction } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactCurrency, formatNumber, formatPercent } from "@/lib/format";

const PROJECT_RATES = [0.08, 0.1, 0.12, 0.14];
const TERMINAL_RATES = [0, 0.01, 0.02, 0.03];

interface FormState {
  baseFcf: string;
  growthPct: string;
  years: string;
  discountPct: string;
  terminalPct: string;
  netDebt: string;
  shares: string;
}

function buildFormState(context: DcfCompanyContext): FormState {
  const latestFcf = [...context.fcfHistory].reverse().find((row) => row.fcf !== null);
  const growthDefault = context.revenueCagr3y ?? context.revenueCagr5y;
  return {
    baseFcf: latestFcf?.fcf !== null && latestFcf !== undefined ? String(Math.round(latestFcf.fcf * 100) / 100) : "",
    growthPct: growthDefault !== null ? String(Math.round((growthDefault as number) * 1000) / 10) : "",
    years: "5",
    discountPct: "10",
    terminalPct: "2.5",
    netDebt: context.netDebt !== null ? String(Math.round(context.netDebt * 100) / 100) : "",
    shares: context.company.sharesOutstanding !== null ? String(context.company.sharesOutstanding) : "",
  };
}

function parseNumber(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && raw.trim() !== "" ? value : null;
}

const inputClass =
  "h-10 w-full rounded-[8px] border border-control bg-surface px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent";

export function ValuationView({
  context,
  scenarios,
}: {
  context: DcfCompanyContext;
  scenarios: ValuationScenario[];
}) {
  const initial = buildFormState(context);
  const [form, setForm] = useState<FormState>(initial);
  const [scenarioName, setScenarioName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (key: keyof FormState) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const assumptions = useMemo<DcfInput>(() => ({
    baseFcf: parseNumber(form.baseFcf) ?? 0,
    yearlyGrowth: Array.from({ length: Math.max(1, Math.min(10, parseNumber(form.years) ?? 5)) }, () => (parseNumber(form.growthPct) ?? 0) / 100),
    discountRate: (parseNumber(form.discountPct) ?? 0) / 100,
    terminalGrowth: (parseNumber(form.terminalPct) ?? 0) / 100,
    netDebt: parseNumber(form.netDebt),
    sharesOutstanding: parseNumber(form.shares),
    currentPrice: context.latestClose?.close ?? null,
  }), [form, context.latestClose]);

  const result = useMemo(() => computeDcf(assumptions), [assumptions]);
  const grid = useMemo(
    () => sensitivityPerShare(assumptions, PROJECT_RATES, TERMINAL_RATES),
    [assumptions],
  );

  const currency = context.company.currency;
  const hasHistory = context.fcfHistory.some((row) => row.fcf !== null);

  function handleSave() {
    setActionError(null);
    startTransition(async () => {
      const payload = {
        baseFcf: assumptions.baseFcf,
        yearlyGrowth: assumptions.yearlyGrowth,
        discountRate: assumptions.discountRate,
        terminalGrowth: assumptions.terminalGrowth,
        netDebt: assumptions.netDebt,
        sharesOutstanding: assumptions.sharesOutstanding,
      };
      const response = await saveValuationScenarioAction(
        context.company.id,
        scenarioName,
        payload as unknown as Record<string, number | string | null>,
        { perShare: result.perShare, enterpriseValue: result.enterpriseValue, errors: result.errors },
      );
      if (!response.ok) setActionError(response.error ?? "Gagal menyimpan skenario.");
      else setScenarioName("");
    });
  }

  function handleLoad(scenario: ValuationScenario) {
    const a = scenario.assumptions as Record<string, unknown>;
    const growth = Array.isArray(a.yearlyGrowth) && a.yearlyGrowth.length > 0 ? (a.yearlyGrowth[0] as number) * 100 : null;
    setForm({
      baseFcf: typeof a.baseFcf === "number" ? String(a.baseFcf) : "",
      growthPct: growth !== null ? String(Math.round(growth * 10) / 10) : "",
      years: Array.isArray(a.yearlyGrowth) ? String(a.yearlyGrowth.length) : "5",
      discountPct: typeof a.discountRate === "number" ? String(a.discountRate * 100) : "10",
      terminalPct: typeof a.terminalGrowth === "number" ? String(a.terminalGrowth * 100) : "2.5",
      netDebt: typeof a.netDebt === "number" ? String(a.netDebt) : "",
      shares: typeof a.sharesOutstanding === "number" ? String(a.sharesOutstanding) : "",
    });
  }

  function handleDelete(id: string) {
    setActionError(null);
    startTransition(async () => {
      const response = await deleteValuationScenarioAction(id);
      if (!response.ok) setActionError(response.error ?? "Gagal menghapus skenario.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Asumsi DCF</CardTitle>
            <CardDescription>
              Hasil dihitung ulang langsung saat mengetik. Default diambil dari data
              tersimpan: FCF tahun terakhir, CAGR pendapatan 3 th, hutang bersih neraca
              ({context.netDebtBasis === "debt" ? "total_debt − kas" : context.netDebtBasis === "liabilities" ? "total_liabilities − kas" : "belum tersedia"}).
              Semua asumsi tetap bisa ditimpa manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">FCF dasar ({currency})</span>
                <input type="number" step="0.01" value={form.baseFcf} onChange={set("baseFcf")} className={inputClass} aria-label="FCF dasar" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Laju pertumbuhan per tahun (%)</span>
                <input type="number" step="0.1" value={form.growthPct} onChange={set("growthPct")} className={inputClass} aria-label="Laju pertumbuhan per tahun dalam persen" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Tahun proyeksi eksplisit</span>
                <select value={form.years} onChange={set("years")} className={inputClass} aria-label="Jumlah tahun proyeksi">
                  {[5, 7, 10].map((year) => (
                    <option key={year} value={year}>{year} tahun</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Diskonto / WACC (%)</span>
                <input type="number" step="0.1" value={form.discountPct} onChange={set("discountPct")} className={inputClass} aria-label="Diskonto WACC dalam persen" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Pertumbuhan terminal (%)</span>
                <input type="number" step="0.1" value={form.terminalPct} onChange={set("terminalPct")} className={inputClass} aria-label="Pertumbuhan terminal dalam persen" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Hutang bersih ({currency})</span>
                <input type="number" step="0.01" value={form.netDebt} onChange={set("netDebt")} className={inputClass} aria-label="Hutang bersih" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Saham beredar (unit)</span>
                <input type="number" step="1" value={form.shares} onChange={set("shares")} className={inputClass} aria-label="Jumlah saham beredar" />
              </label>
              <div className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Harga acuan (pembacaan)</span>
                <p className="tnum text-sm">
                  {context.latestClose
                    ? `${formatCompactCurrency(context.latestClose.close, currency)} · ${context.latestClose.date}`
                    : "— belum ada harga tersimpan"}
                </p>
              </div>
            </div>
            {!hasHistory && form.baseFcf === "" ? (
              <p className="text-xs text-danger">
                Belum ada riwayat arus kas tersimpan — isi FCF dasar manual (dari laporan
                keuangan yang Anda percaya). Angka tidak dibuat-buat di belakang layar.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hasil</CardTitle>
            <CardDescription>{result.errors.length > 0 ? result.errors.join(" ") : "Model Gordon + proyeksi eksplisit."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              <span className="block text-xs text-muted-foreground">Nilai intrinsik per saham</span>
              <span className="tnum text-3xl font-semibold">
                {result.perShare === null ? "—" : formatNumber(result.perShare, 2)}
              </span>
              {result.perShare !== null && context.latestClose ? (
                <span className="tnum ml-2 text-xs">
                  vs harga {formatNumber(context.latestClose.close, 2)} ·{" "}
                  MoS {formatPercent(result.marginOfSafety, { signed: true })}
                </span>
              ) : null}
            </p>
            <dl className="tnum grid gap-1 text-xs">
              {[
                ["PV proyeksi eksplisit", result.pvExplicit],
                ["Terminal value (Gordon)", result.terminalValue],
                ["PV terminal value", result.pvTerminalValue],
                ["Enterprise value", result.enterpriseValue],
                ["Equity value (− hutang bersih)", result.equityValue],
              ].map(([label, value]) => (
                <div className="flex justify-between gap-4 border-b border-border/40 pb-1" key={label as string}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{formatCompactCurrency(value as number | null, currency)}</dd>
                </div>
              ))}
            </dl>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">FCF proyeksi (5 tahun pertama)</summary>
              <table className="mt-2 w-full">
                <tbody className="tnum">
                  {(result.projectedFcf ?? []).slice(0, 10).map((fcf, index) => (
                    <tr key={index}>
                      <td className="pr-4">Tahun {index + 1}</td>
                      <td className="pr-4 text-muted-foreground">{formatCompactCurrency(fcf, currency)}</td>
                      <td>PV {formatCompactCurrency(result.discountedFcf?.[index] ?? null, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sensitivitas: nilai per saham ({currency})</CardTitle>
          <CardDescription>
            Diskonto (baris) × pertumbuhan terminal (kolom). Klik sel untuk menerapkan
            kombinasi ke asumsi; sel — berarti gT ≥ diskonto baris itu (tak valid).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {grid.values.flat().some((cell) => cell !== null) ? (
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="px-2 py-2 font-medium">Diskonto ↓ / gT →</th>
                  {grid.columns.map((growth) => (
                    <th scope="col" key={growth} className="tnum px-2 py-2 font-medium">{formatNumber(growth * 100, 1)}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((rate, rowIndex) => (
                  <tr key={rate} className="border-b border-border/40">
                    <th scope="row" className="tnum px-2 py-2 text-xs font-normal text-muted-foreground">{formatNumber(rate * 100, 1)}%</th>
                    {grid.columns.map((growth, colIndex) => {
                      const cell = grid.values[rowIndex][colIndex];
                      const matching =
                        Math.abs(assumptions.discountRate - rate) < 1e-9 &&
                        Math.abs(assumptions.terminalGrowth - growth) < 1e-9;
                      return (
                        <td key={growth} className={matching ? "bg-muted/60 px-2 py-2" : "px-2 py-2"}>
                          {cell === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setForm((current) => ({
                                  ...current,
                                  discountPct: String(Math.round(rate * 1000) / 10),
                                  terminalPct: String(Math.round(growth * 1000) / 10),
                                }));
                              }}
                              className="tnum cursor-pointer hover:text-foreground"
                            >
                              {formatNumber(cell, 2)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">
              Matriks menunggu saham beredar &gt; 0 dan laju pertumbuhan proyeksi yang
              valid — keduanya jangan dibuat-buat. Sel per-saham = equity ÷ saham.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skenario tersimpan</CardTitle>
          <CardDescription>
            Asumsi & hasil disimpan ke akun Anda (valuation_scenarios) untuk perusahaan ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={scenarioName}
              onChange={(event) => setScenarioName(event.target.value)}
              placeholder="Nama skenario, mis. Konservatif g=5%"
              aria-label="Nama skenario"
              className={`${inputClass} max-w-xs`}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || scenarioName.trim() === ""}
              className={buttonVariants({ size: "sm" })}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Simpan skenario
            </button>
            {actionError ? <span className="text-xs text-danger">{actionError}</span> : null}
          </div>
          {scenarios.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada skenario tersimpan.</p>
          ) : (
            <ul className="space-y-2">
              {scenarios.map((scenario) => (
                <li
                  key={scenario.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-3 py-2"
                >
                  <span className="text-sm">
                    {scenario.name}
                    <span className="tnum ml-2 text-xs text-muted-foreground">
                      per saham{" "}
                      {typeof scenario.results.perShare === "number"
                        ? formatNumber(scenario.results.perShare, 2)
                        : "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={() => handleLoad(scenario)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Muat
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(scenario.id)}
                      disabled={isPending}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Hapus
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

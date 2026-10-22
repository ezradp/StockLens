"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Trash2, Plus, FolderMinus } from "lucide-react";
import { allocationBreakdown, type PortfolioSummary, type TransactionType } from "@/engine/portfolio";
import type { PortfolioBundle } from "@/server/portfolio";
import { deletePortfolioAction, addTransactionAction, createPortfolioAction, deleteTransactionAction } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactCurrency, formatNumber, formatPercent, formatDate } from "@/lib/format";

const PIE_COLORS = ["#4a8ad6", "#2f639c", "#79a7dd", "#a3c2e8", "#8a8c92", "#5f6168", "#c9d9ec", "#3a3f4a"];

const TX_LABELS: Record<TransactionType, string> = {
  buy: "Beli",
  sell: "Jual",
  deposit: "Deposit",
  withdrawal: "Tarik",
  dividend: "Dividen",
  fee: "Fee",
};

const inputClass =
  "h-10 w-full rounded-[8px] border border-control bg-surface px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent";

export function PortfolioView({
  portfolios,
  activeId,
  bundle,
}: {
  portfolios: Array<{ id: string; name: string; baseCurrency: string }>;
  activeId: string | null;
  bundle: PortfolioBundle | null;
}) {
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [formError, setFormError] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({
    transactionType: "buy" as TransactionType,
    companyId: "",
    transactionDate: new Date().toISOString().slice(0, 10),
    quantity: "",
    price: "",
    amount: "",
    fees: "0",
    notes: "",
  });
  const [creating, startCreate] = useTransition();

  const needsTradeFields = txForm.transactionType === "buy" || txForm.transactionType === "sell";

  function handleCreate() {
    setFormError(null);
    startCreate(async () => {
      const result = await createPortfolioAction(newName, newCurrency);
      if (result.ok) setNewName("");
      else setFormError(result.error ?? "Gagal membuat portofolio.");
    });
  }

  function handleAddTransaction() {
    setFormError(null);
    if (!activeId) {
      setFormError("Buat / pilih portofolio dulu.");
      return;
    }
    startCreate(async () => {
      const result = await addTransactionAction(activeId, {
        transactionType: txForm.transactionType,
        transactionDate: txForm.transactionDate,
        companyId: txForm.companyId === "" ? null : txForm.companyId,
        quantity: needsTradeFields ? txForm.quantity : null,
        price: needsTradeFields ? txForm.price : null,
        amount: needsTradeFields ? null : txForm.amount,
        fees: txForm.fees === "" ? "0" : txForm.fees,
      }, bundle?.portfolio.baseCurrency ?? newCurrency, needsTradeFields ? null : (txForm.notes.trim() === "" ? null : txForm.notes));
      if (result.ok) {
        setTxForm((current) => ({ ...current, quantity: "", price: "", amount: "", notes: "" }));
      } else {
        setFormError(result.error ?? "Gagal menyimpan transaksi.");
      }
    });
  }

  const currency = bundle?.portfolio.baseCurrency ?? "USD";
  const summary: PortfolioSummary | null = bundle?.summary ?? null;
  const companyAllocation = useMemo(
    () => (summary ? allocationBreakdown(summary.positions, "company") : { slices: [], excluded: 0 }),
    [summary],
  );
  const sectorAllocation = useMemo(
    () => (summary ? allocationBreakdown(summary.positions, "sector") : { slices: [], excluded: 0 }),
    [summary],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portofolio ({portfolios.length})</CardTitle>
          <CardDescription>
            Nama unik per akun; deposit/withdrawal hanya menyentuh kas — tidak pernah
            dihitung sebagai keuntungan investasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {portfolios.length > 0 ? (
            <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              {portfolios.map((portfolio) => (
                <li key={portfolio.id}>
                  <Link
                    href={`/portfolio?id=${portfolio.id}`}
                    className={
                      portfolio.id === activeId
                        ? "rule-active inline-flex items-baseline gap-1 text-[13px] text-foreground"
                        : "inline-flex items-baseline gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {portfolio.name}
                    <span className="tnum text-[10px]">({portfolio.baseCurrency})</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada portofolio — buat satu di bawah.</p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Nama portofolio</span>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="mis. Saham blue chip"
                aria-label="Nama portofolio baru"
                className={`${inputClass} w-56`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Base</span>
              <input
                type="text"
                value={newCurrency}
                onChange={(event) => setNewCurrency(event.target.value.toUpperCase().slice(0, 3))}
                aria-label="Mata uang dasar portofolio"
                className={inputClass}
                style={{ width: "4.5rem" }}
              />
            </label>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || newName.trim() === ""}
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buat portofolio
            </button>
            {activeId ? (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  startCreate(async () => {
                    const result = await deletePortfolioAction(activeId);
                    if (!result.ok) setFormError(result.error ?? "Gagal menghapus portofolio.");
                  });
                }}
                disabled={creating}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <FolderMinus className="h-4 w-4" aria-hidden="true" />
                Hapus portofolio aktif
              </button>
            ) : null}
          </div>
          {formError ? <p className="text-xs text-danger">{formError}</p> : null}
        </CardContent>
      </Card>

      {bundle === null || summary === null ? (
        <p className="border-t border-rule px-6 py-10 text-center text-[13px] text-muted-foreground">
          Pilih portofolio di atas untuk mulai mencatat transaksi.
        </p>
      ) : (
        <>
          {bundle.warnings.length > 0 ? (
            <ul className="mb-5 space-y-1 rounded-[var(--radius-card)] border-l-2 border-warning bg-[var(--pill-warning-bg)] px-4 py-3 text-xs text-[color:var(--pill-warning-ink)]">
              {bundle.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <Card className="mb-5 overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-rule xl:grid-cols-4">
              {[
                { label: "Nilai total", value: formatCompactCurrency(summary.totalValue, currency), note: summary.totalValue === null ? "menunggu harga semua posisi" : "kas + pasar" },
                { label: "Kas", value: formatCompactCurrency(summary.cashBalance, currency), note: `deposito bersih ${formatCompactCurrency(summary.netDeposits, currency)}` },
                { label: "Unrealized P/L", value: marketValueLine(summary), note: summary.positionsWithoutPrice > 0 ? `${summary.positionsWithoutPrice} posisi tanpa harga` : "posisi terbuka" },
                { label: "Realized P/L", value: formatCompactCurrency(summary.realizedPlTotal, currency), note: `dividen ${formatCompactCurrency(summary.dividendsTotal, currency)} · fee ${formatCompactCurrency(summary.feesTotal, currency)}` },
              ].map((cell) => (
                <div key={cell.label} className="bg-card px-5 py-4">
                  <p className="text-[11px] leading-4 text-muted-foreground">{cell.label}</p>
                  <p className="tnum mt-1.5 text-[20px] font-medium leading-6">{cell.value}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {cell.note}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Alokasi per perusahaan</CardTitle>
                <CardDescription>
                  Atas nilai pasar yang dikenal; posisi tanpa harga tidak dipalsukan
                  {companyAllocation.excluded > 0 ? ` (${companyAllocation.excluded} posisi dikeluarkan)` : ""}
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {companyAllocation.slices.length > 0 ? (
                  <>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={companyAllocation.slices}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="55%"
                            outerRadius="80%"
                            stroke="none"
                          >
                            {companyAllocation.slices.map((slice, index) => (
                              <Cell key={slice.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "#1d1f21", border: "1px solid #3a3d42", fontSize: 12 }}
                            formatter={(value, name) => [formatCompactCurrency(Number(value), currency), String(name)]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="tnum mt-2 space-y-1 text-xs">
                      {companyAllocation.slices.slice(0, 8).map((slice, index) => (
                        <li key={slice.label} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                              aria-hidden="true"
                            />
                            {slice.label}
                          </span>
                          <span>{formatPercent(slice.share)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="pt-14 text-center text-xs text-muted-foreground">
                    Donut menunggu harga terkini — kini semua nilai masih —.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alokasi per sektor</CardTitle>
                <CardDescription>
                  {sectorAllocation.excluded > 0 ? `${sectorAllocation.excluded} posisi tanpa harga dikeluarkan.` : "Persentase atas nilai pasar yang dikenal."}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {sectorAllocation.slices.length > 0 ? (
                  <>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sectorAllocation.slices}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="55%"
                            outerRadius="80%"
                            stroke="none"
                          >
                            {sectorAllocation.slices.map((slice, index) => (
                              <Cell key={slice.label} fill={PIE_COLORS[(index + 3) % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "#1d1f21", border: "1px solid #3a3d42", fontSize: 12 }}
                            formatter={(value, name) => [formatCompactCurrency(Number(value), currency), String(name)]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="tnum mt-2 space-y-1 text-xs">
                      {sectorAllocation.slices.slice(0, 8).map((slice, index) => (
                        <li key={slice.label} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: PIE_COLORS[(index + 3) % PIE_COLORS.length] }}
                              aria-hidden="true"
                            />
                            {slice.label}
                          </span>
                          <span>{formatPercent(slice.share)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="pt-14 text-center text-xs text-muted-foreground">
                    Donut menunggu harga; daftar % muncul bersamaan dengannya.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Holdings</CardTitle>
                <CardDescription>
                  Basis biaya rata-rata (pembelian + fee); P/L terwujud menumpuk dari penjualan.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {summary.positions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada posisi — catat transaksi buy di bawah.</p>
                ) : (
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th scope="col" className="px-2 py-2 font-medium">Ticker</th>
                        <th scope="col" className="px-2 py-2 font-medium">Qty</th>
                        <th scope="col" className="px-2 py-2 font-medium">Avg cost</th>
                        <th scope="col" className="px-2 py-2 font-medium">Basis</th>
                        <th scope="col" className="px-2 py-2 font-medium">Harga terakhir</th>
                        <th scope="col" className="px-2 py-2 font-medium">Nilai</th>
                        <th scope="col" className="px-2 py-2 font-medium">Unrealized</th>
                        <th scope="col" className="px-2 py-2 font-medium">Realized</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.positions.map((position) => (
                        <tr key={position.companyId} className="border-b border-border/40">
                          <td className="px-2 py-2">
                            <Link href={`/explorer/${position.ticker}`} className="font-semibold text-foreground underline decoration-control underline-offset-4 hover:decoration-accent">
                              {position.ticker}
                            </Link>
                            <span className="block text-xs text-muted-foreground">{position.name}</span>
                          </td>
                          <td className="tnum px-2 py-2">{position.quantity === null ? "—" : formatNumber(position.quantity, 4)}</td>
                          <td className="tnum px-2 py-2">{position.averageCost === null ? "—" : formatNumber(position.averageCost, 2)}</td>
                          <td className="tnum px-2 py-2">{formatCompactCurrency(position.costBasis, position.currency)}</td>
                          <td className="tnum px-2 py-2">
                            {position.latestPrice === null
                              ? "—"
                              : `${formatNumber(position.latestPrice, 2)} · ${formatDate(position.latestPriceDate)}`}
                          </td>
                          <td className="tnum px-2 py-2">{formatCompactCurrency(position.marketValue, position.currency)}</td>
                          <td className="tnum px-2 py-2">
                            {position.unrealizedPl === null
                              ? "—"
                              : `${formatNumber(position.unrealizedPl, 2)} (${formatPercent(position.unrealizedPlPct, { signed: true })})`}
                          </td>
                          <td className="tnum px-2 py-2">{formatCompactCurrency(position.realizedPl, position.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Catat transaksi</CardTitle>
                <CardDescription>
                  {needsTradeFields
                    ? "Beli/jual: pilih perusahaan + jumlah + harga. Fee ikut menaikkan basis pembelian."
                    : txForm.transactionType === "deposit" || txForm.transactionType === "withdrawal"
                      ? "Murni kas — tanpa perusahaan."
                      : "Dividen/fee: nominal; perusahaan opsional sebagai catatan."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Jenis</span>
                    <select
                      value={txForm.transactionType}
                      onChange={(event) => setTxForm((current) => ({ ...current, transactionType: event.target.value as TransactionType }))}
                      className={inputClass}
                    >
                      {(Object.keys(TX_LABELS) as TransactionType[]).map((type) => (
                        <option key={type} value={type}>{TX_LABELS[type]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Tanggal</span>
                    <input
                      type="date"
                      value={txForm.transactionDate}
                      onChange={(event) => setTxForm((current) => ({ ...current, transactionDate: event.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  {needsTradeFields ? (
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs text-muted-foreground">Perusahaan</span>
                      <select
                        value={txForm.companyId}
                        onChange={(event) => setTxForm((current) => ({ ...current, companyId: event.target.value }))}
                        className={inputClass}
                      >
                        <option value="">— pilih perusahaan —</option>
                        {(bundle.companyOptions ?? []).map((company) => (
                          <option key={company.companyId} value={company.companyId}>
                            {company.ticker} — {company.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : txForm.transactionType === "dividend" || txForm.transactionType === "fee" ? (
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs text-muted-foreground">Perusahaan (opsional)</span>
                      <input
                        type="text"
                        value={txForm.notes}
                        onChange={(event) => setTxForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="catatan, mis. dividen Q1 AAAA"
                        className={inputClass}
                      />
                    </label>
                  ) : null}
                  {needsTradeFields ? (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">Jumlah saham</span>
                        <input type="number" step="0.0001" value={txForm.quantity} onChange={(event) => setTxForm((current) => ({ ...current, quantity: event.target.value }))} className={inputClass} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">Harga per saham</span>
                        <input type="number" step="0.0001" value={txForm.price} onChange={(event) => setTxForm((current) => ({ ...current, price: event.target.value }))} className={inputClass} />
                      </label>
                    </>
                  ) : (
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted-foreground">Nominal ({currency})</span>
                      <input type="number" step="0.01" value={txForm.amount} onChange={(event) => setTxForm((current) => ({ ...current, amount: event.target.value }))} className={inputClass} />
                    </label>
                  )}
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Fee ({currency})</span>
                    <input type="number" step="0.01" value={txForm.fees} onChange={(event) => setTxForm((current) => ({ ...current, fees: event.target.value }))} className={inputClass} />
                  </label>
                </div>
                <button type="button" onClick={handleAddTransaction} disabled={creating} className={buttonVariants({ size: "sm" })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Simpan transaksi
                </button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat transaksi ({bundle.transactions.length})</CardTitle>
              <CardDescription>Urut tanggal; setiap barisan menyimpan asal-usulnya di DB.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-2 py-2 font-medium">Tanggal</th>
                    <th scope="col" className="px-2 py-2 font-medium">Jenis</th>
                    <th scope="col" className="px-2 py-2 font-medium">Perusahaan</th>
                    <th scope="col" className="px-2 py-2 font-medium">Qty</th>
                    <th scope="col" className="px-2 py-2 font-medium">Harga</th>
                    <th scope="col" className="px-2 py-2 font-medium">Nominal</th>
                    <th scope="col" className="px-2 py-2 font-medium">Fee</th>
                    <th scope="col" className="px-2 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/40">
                      <td className="tnum px-2 py-2">{tx.transactionDate}</td>
                      <td className="px-2 py-2">{TX_LABELS[tx.transactionType]}</td>
                      <td className="px-2 py-2">{tx.ticker ?? "—"}</td>
                      <td className="tnum px-2 py-2">{tx.quantity === null ? "—" : formatNumber(tx.quantity, 4)}</td>
                      <td className="tnum px-2 py-2">{tx.price === null ? "—" : formatNumber(tx.price, 2)}</td>
                      <td className="tnum px-2 py-2">{formatCompactCurrency(tx.amount, currency)}</td>
                      <td className="tnum px-2 py-2">{formatNumber(tx.fees, 2)}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            startCreate(async () => {
                              const result = await deleteTransactionAction(bundle.portfolio.id, tx.id);
                              if (!result.ok) setFormError(result.error ?? "Gagal menghapus transaksi.");
                            });
                          }}
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                          aria-label={`Hapus transaksi ${tx.transactionType} ${tx.transactionDate}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function marketValueLine(summary: PortfolioSummary): string {
  const openWithPrice = summary.positions.filter(
    (position) => position.quantity !== null && position.marketValue !== null,
  );
  if (openWithPrice.length === 0) return "—";
  const unrealized = openWithPrice.reduce((sum, position) => sum + (position.unrealizedPl as number), 0);
  const basis = openWithPrice.reduce((sum, position) => sum + (position.costBasis as number), 0);
  const pct = basis > 0 ? unrealized / basis : null;
  return `${formatCompactCurrency(unrealized, openWithPrice[0].currency)}${pct !== null ? ` (${formatPercent(pct, { signed: true })})` : ""}`;
}

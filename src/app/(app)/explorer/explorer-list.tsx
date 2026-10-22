"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import type { CompanySummary } from "@/server/companies";

/**
 * Kisi perusahaan + filter teks murni-client (tanpa fetch ulang).
 * Kartu selalu tautan nyata — Explorer detail menerimanya.
 */
export function ExplorerList({ companies }: { companies: CompanySummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return companies;
    return companies.filter((company) =>
      `${company.ticker} ${company.name} ${company.sector ?? ""}`.toLowerCase().includes(needle),
    );
  }, [companies, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari ticker, nama, atau sektor…"
          aria-label="Cari perusahaan"
          className="h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} dari {companies.length} perusahaan
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
          Tidak ada perusahaan yang cocok dengan “{query}”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((company) => (
            <Link key={company.ticker} href={`/explorer/${company.ticker}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/25">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold tracking-tight">{company.ticker}</p>
                      <p className="text-xs text-muted-foreground">{company.name}</p>
                    </div>
                    {company.sector ? <Badge variant="outline">{company.sector}</Badge> : null}
                  </div>

                  <dl className="tnum space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Harga terakhir</dt>
                      <dd>
                        {company.latestClose !== null
                          ? `${formatCurrency(company.latestClose)} · ${formatDate(company.latestPriceDate)}`
                          : "— belum ada harga"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Pendapatan (terakhir)</dt>
                      <dd>{formatCompactCurrency(company.latestRevenue)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Laba bersih (terakhir)</dt>
                      <dd>{formatCompactCurrency(company.latestNetIncome)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Sumber keuangan</dt>
                      <dd>
                        {company.incomeYears > 0
                          ? `${company.incomeYears} tahun laporan`
                          : "— belum ada laporan"}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

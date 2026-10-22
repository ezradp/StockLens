"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import type { CompanySummary } from "@/server/companies";

/**
 * Daftar perusahaan + filter teks murni-client (tanpa fetch ulang).
 * Satu baris per emiten: identitas, sektor, harga, dua angka laporan, kedalaman data.
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
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari ticker, nama, atau sektor…"
          aria-label="Cari perusahaan"
          className="h-9 w-full max-w-[300px] rounded-[8px] border border-control bg-surface px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
        />
        <span className="tnum text-[11px] text-muted-foreground">
          {filtered.length} / {companies.length} emiten
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="border-t border-rule px-6 py-10 text-center text-[13px] text-muted-foreground">
          Tidak ada perusahaan yang cocok dengan “{query}”.
        </p>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto px-2 py-2">
            <table className="w-full border-collapse text-left md:min-w-[820px]">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="h-9 px-2 text-[11px] font-normal text-muted-foreground">
                    Emiten
                  </th>
                  <th scope="col" className="hidden h-9 px-2 text-[11px] font-normal text-muted-foreground md:table-cell">
                    Sektor
                  </th>
                  <th scope="col" className="h-9 px-2 text-right text-[11px] font-normal text-muted-foreground">
                    Harga terakhir
                  </th>
                  <th scope="col" className="h-9 px-2 text-right text-[11px] font-normal text-muted-foreground">
                    Pendapatan
                  </th>
                  <th scope="col" className="hidden h-9 px-2 text-right text-[11px] font-normal text-muted-foreground md:table-cell">
                    Laba bersih
                  </th>
                  <th scope="col" className="hidden h-9 px-2 text-right text-[11px] font-normal text-muted-foreground md:table-cell">
                    Laporan
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company) => (
                  <tr key={company.ticker} className="border-b border-rule last:border-b-0">
                    <td className="h-[46px] px-2">
                      <Link
                        href={`/explorer/${company.ticker}`}
                        className="text-[13px] font-semibold text-foreground decoration-accent/60 underline-offset-4 hover:underline"
                      >
                        {company.ticker}
                      </Link>
                      <span
                        className="ml-2 inline-block max-w-[120px] truncate align-bottom text-[11px] text-muted-foreground md:max-w-[190px]"
                        title={company.name}
                      >
                        {company.name}
                      </span>
                    </td>
                    <td className="hidden h-[46px] px-2 md:table-cell">
                      <span
                        className="block max-w-[190px] truncate text-xs text-muted-foreground"
                        title={company.sector ?? undefined}
                      >
                        {company.sector ?? "—"}
                      </span>
                    </td>
                    <td className="tnum h-[46px] px-2 text-right">
                      {company.latestClose !== null ? (
                        <>
                          <span className="block text-[13px]">{formatCurrency(company.latestClose)}</span>
                          <span className="block whitespace-nowrap text-[11px] text-muted-foreground">
                            {formatDate(company.latestPriceDate)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="tnum h-[46px] px-2 text-right text-[13px]">
                      {company.latestRevenue === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCompactCurrency(company.latestRevenue)
                      )}
                    </td>
                    <td className="tnum hidden h-[46px] px-2 text-right text-[13px] md:table-cell">
                      {company.latestNetIncome === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCompactCurrency(company.latestNetIncome)
                      )}
                    </td>
                    <td className="tnum hidden h-[46px] px-2 text-right text-[13px] text-muted-foreground md:table-cell">
                      {company.incomeYears > 0 ? `${company.incomeYears} th` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

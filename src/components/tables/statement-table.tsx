/**
 * Tabel laporan keuangan — kolom = periode terbaru dulu (statis, server-rendered).
 * Nilai "—" untuk metrik yang tidak tersedia; tidak pernah menampilkan 0 palsu.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface StatementColumn {
  periodEnd: string;
  label: string;
}

export interface StatementRowData {
  label: string;
  /** Nilai terformat per kolom (urut sama dengan columns). */
  values: string[];
}

export interface StatementTableData {
  title: string;
  note?: string;
  columns: StatementColumn[];
  rows: StatementRowData[];
}

interface RawStatement {
  periodEnd: string;
  data: Record<string, number>;
}

/**
 * Bangun data tabel dari snapshot laporan.
 * `rows` [labelKartu → key data_json + formatter]; baris dengan SEMUA kolom kosong
 * tetap ditampilkan (menunjukkan metrik yang ADA tapi sel itu tak terisi) — jujur.
 */
export function buildStatementTable(
  title: string,
  statements: RawStatement[],
  periodEnds: string[],
  formatter: (value: number, periodEnd: string) => string,
  metricDefs: Array<{ label: string; key: string }>,
  note?: string,
): StatementTableData {
  const byPeriod = new Map(statements.map((statement) => [statement.periodEnd, statement]));
  const columns = periodEnds.map((periodEnd) => ({ periodEnd, label: periodEnd }));
  const rows = metricDefs.map(({ label, key }) => ({
    label,
    values: periodEnds.map((periodEnd) => {
      const value = byPeriod.get(periodEnd)?.data[key];
      return typeof value === "number" && Number.isFinite(value) ? formatter(value, periodEnd) : "—";
    }),
  }));
  return { title, note, columns, rows };
}

/** Presentational card untuk satu jenis laporan keuangan. */
export function StatementTableCard({ data }: { data: StatementTableData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
        {data.note ? <CardDescription>{data.note}</CardDescription> : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="px-2 py-2 font-medium">
                Metrik
              </th>
              {data.columns.map((column) => (
                <th scope="col" className="tnum px-2 py-2 font-medium" key={column.periodEnd}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.label} className="border-b border-border/40">
                <th scope="row" className="px-2 py-2 text-xs font-normal text-muted-foreground">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td className="tnum px-2 py-2" key={`${row.label}-${index}`}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

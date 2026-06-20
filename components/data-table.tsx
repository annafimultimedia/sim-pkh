"use client";

import { ArrowDownUp, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";
import { MaskedNik } from "./masked-nik";

export type Column<T> = {
  key: keyof T | string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  value?: (item: T) => string | number | undefined;
  className?: string;
  headerClassName?: string;
  maskNik?: boolean;
};

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  filename = "data",
  rowClassName,
  onVisibleRowsChange,
  searchPlaceholder = "Search Nama / NIK / No KK / kolom lain..."
}: {
  rows: T[];
  columns: Column<T>[];
  filename?: string;
  rowClassName?: (row: T) => string;
  onVisibleRowsChange?: (rows: T[]) => void;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const result = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
    if (!sort) return result;
    return [...result].sort((a, b) => {
      const av = String(a[sort.key] ?? "");
      const bv = String(b[sort.key] ?? "");
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [query, rows, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  useEffect(() => {
    onVisibleRowsChange?.(pageRows);
  }, [onVisibleRowsChange, pageRows]);

  function toggleSort(key: string) {
    setSort((current) => (current?.key === key && current.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" }));
  }

  function getValue(row: T, col: Column<T>) {
    return col.value ? col.value(row) : String(row[col.key] ?? "");
  }

  function exportExcel() {
    const data = filtered.map((row) => Object.fromEntries(columns.map((col) => [typeof col.header === "string" ? col.header : String(col.key), getValue(row, col)])));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  return (
    <section className="rounded-2xl border border-border bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-lg border border-border pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-10 min-w-0 rounded-lg border border-border bg-white px-2 text-sm sm:px-3">
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} baris
              </option>
            ))}
          </select>
          <button onClick={exportExcel} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-2 text-sm font-medium hover:bg-muted sm:px-3">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>
      <div className="table-scroll overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className={`whitespace-nowrap border-b border-border px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 ${col.headerClassName ?? ""}`}>
                  {typeof col.header === "string" ? (
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort(String(col.key))}>
                      {col.header}
                      <ArrowDownUp className="h-3 w-3" />
                    </button>
                  ) : col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr key={index} className={`border-b border-border ${rowClassName?.(row) ?? ""}`}>
                {columns.map((col) => (
                  <td key={String(col.key)} className={`whitespace-nowrap border-b border-border px-3 py-2.5 align-top ${col.className ?? ""}`}>
                    {col.render ? col.render(row) : col.maskNik ? <MaskedNik nik={String(getValue(row, col))} /> : String(getValue(row, col))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <span>
          Menampilkan {pageRows.length} dari {filtered.length} data
        </span>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
          <button className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Berikutnya
          </button>
        </div>
      </div>
    </section>
  );
}

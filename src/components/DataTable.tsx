import type { ReactNode } from "react";

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="data-table">
    <div className="data-head" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(110px, 1fr))` }}>{headers.map(item => <span key={item}>{item}</span>)}</div>
    {rows.map((row, rowIndex) => <div className="data-row" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(110px, 1fr))` }} key={rowIndex}>{row.map((cell, cellIndex) => <div key={cellIndex}>{cell}</div>)}</div>)}
  </div>;
}

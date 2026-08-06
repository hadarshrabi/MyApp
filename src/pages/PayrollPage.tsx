import { useEffect, useState } from "react";
import { PageIntro } from "../components/PageIntro";
import { SwipeSheet } from "../components/SwipeSheet";
import { useBusinessData } from "../context/BusinessDataContext";
import { apiClient } from "../services/apiClient";
import { money } from "../utils/format";

type ProductReport = { productId: string; productName: string; quantity: number; amountCents: number };
type EmployeeReport = {
  employeeId: string; employeeName: string; jobPosition: string; assignedStation: string; hourlyRateCents: number;
  workDays: number; totalMinutes: number; salaryCents: number; salesQuantity: number; salesAmountCents: number; products: ProductReport[];
};
type ShiftReport = {
  id: string; employeeId: string; employeeName: string; jobPosition: string; date: string; clockIn: string; clockOut: string;
  durationMinutes: number; hourlyRateCents: number; salaryCents: number; salesQuantity: number; salesAmountCents: number; products: ProductReport[];
  station: { id: number; name: string; address: string; locationDescription: string | null; latitude: number; longitude: number };
};
type PayrollReport = {
  period: { from: string; to: string };
  summary: { employees: number; workDays: number; totalMinutes: number; salaryCents: number; salesQuantity: number; salesAmountCents: number };
  employees: EmployeeReport[]; shifts: ShiftReport[]; products: ProductReport[];
};
type ReportFilters = { from: string; to: string; employeeId: string; stationId: string };
type ReportView = "EMPLOYEES" | "SHIFTS" | "PRODUCTS";

const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
function dateInputValue(date: Date) { return dateFormatter.format(date); }
function initialFilters(): ReportFilters {
  const now = new Date();
  return { from: dateInputValue(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), to: dateInputValue(now), employeeId: "ALL", stationId: "ALL" };
}
function minutesLabel(minutes: number) { return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`; }
function dateLabel(value: string) { return new Date(`${value}T12:00:00Z`).toLocaleDateString("he-IL"); }

export function PayrollPage() {
  const { employees, stations } = useBusinessData();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<ReportView>("EMPLOYEES");
  const [report, setReport] = useState<PayrollReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReport(next: ReportFilters) {
    setLoading(true); setError("");
    const query = new URLSearchParams({ from: next.from, to: next.to });
    if (next.employeeId !== "ALL") query.set("employeeId", next.employeeId);
    if (next.stationId !== "ALL") query.set("stationId", next.stationId);
    try { setReport(await apiClient.get<PayrollReport>(`/api/admin/reports/payroll?${query.toString()}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "לא ניתן להפיק את הדוח"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadReport(filters); }, []);
  useEffect(() => {
    if (!filtersOpen) return;
    document.documentElement.classList.add("mobile-sheet-open");
    return () => document.documentElement.classList.remove("mobile-sheet-open");
  }, [filtersOpen]);

  function openFilters() { setDraftFilters(filters); setFiltersOpen(true); }
  function applyFilters() {
    if (draftFilters.to < draftFilters.from) { setError("תאריך הסיום חייב להיות אחרי תאריך ההתחלה"); return; }
    setFilters(draftFilters); setFiltersOpen(false); void loadReport(draftFilters);
  }

  function exportCsv() {
    if (!report) return;
    const headers = ["עובד", "תפקיד", "תאריך", "עמדה", "תיאור מיקום", "קו רוחב", "קו אורך", "כניסה", "יציאה", "שעות", "שכר משמרת", "סוג זר", "כמות שנמכרה", "סכום מכירות"];
    const rows = report.shifts.flatMap(shift => (shift.products.length ? shift.products : [{ productId: "", productName: "ללא מכירות", quantity: 0, amountCents: 0 }]).map(product => [
      shift.employeeName, shift.jobPosition, dateLabel(shift.date), shift.station.name, shift.station.locationDescription || shift.station.address,
      shift.station.latitude.toFixed(6), shift.station.longitude.toFixed(6), new Date(shift.clockIn).toLocaleTimeString("he-IL"), new Date(shift.clockOut).toLocaleTimeString("he-IL"),
      minutesLabel(shift.durationMinutes), (shift.salaryCents / 100).toFixed(2), product.productName, product.quantity, (product.amountCents / 100).toFixed(2),
    ]));
    const safeCell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = [headers, ...rows].map(row => row.map(safeCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `דוח-שכר-ומכירות-${filters.from}-${filters.to}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const activeFilterCount = Number(filters.employeeId !== "ALL") + Number(filters.stationId !== "ALL");
  return <div className="payroll-page">
    <PageIntro title="שכר ודוחות" text="שעות, ימי עבודה, מיקום העמדה והמכירות שבוצעו בכל משמרת." />
    <section className="report-command-bar">
      <div><small>תקופת הדוח</small><strong>{dateLabel(filters.from)}–{dateLabel(filters.to)}</strong><span>{activeFilterCount ? `${activeFilterCount} סינונים פעילים` : "כל העובדים וכל העמדות"}</span></div>
      <button className="secondary" type="button" onClick={openFilters}><span>≡</span> סינון{activeFilterCount > 0 && <em>{activeFilterCount}</em>}</button>
      <button className="primary" type="button" disabled={!report || loading} onClick={exportCsv}>הורדת דוח CSV</button>
    </section>

    {error && <div className="report-error" role="alert">{error}<button type="button" onClick={() => void loadReport(filters)}>ניסיון נוסף</button></div>}
    <section className="report-summary" aria-label="סיכום הדוח">
      <article><span>שעות עבודה</span><b>{report ? minutesLabel(report.summary.totalMinutes) : "—"}</b><small>{report?.summary.workDays ?? 0} ימי עבודה</small></article>
      <article><span>שכר לתשלום</span><b>{report ? money(report.summary.salaryCents / 100) : "—"}</b><small>{report?.summary.employees ?? 0} עובדים</small></article>
      <article><span>זרים שנמכרו</span><b>{report?.summary.salesQuantity ?? 0}</b><small>{report?.products.length ?? 0} סוגים</small></article>
      <article><span>סכום מכירות</span><b>{report ? money(report.summary.salesAmountCents / 100) : "—"}</b><small>{report?.shifts.length ?? 0} משמרות</small></article>
    </section>

    <div className="report-tabs" role="tablist" aria-label="סוג הדוח">
      <button className={view === "EMPLOYEES" ? "active" : ""} onClick={() => setView("EMPLOYEES")}>עובדים <span>{report?.employees.length ?? 0}</span></button>
      <button className={view === "SHIFTS" ? "active" : ""} onClick={() => setView("SHIFTS")}>משמרות <span>{report?.shifts.length ?? 0}</span></button>
      <button className={view === "PRODUCTS" ? "active" : ""} onClick={() => setView("PRODUCTS")}>סוגי זרים <span>{report?.products.length ?? 0}</span></button>
    </div>

    {loading ? <section className="report-empty loading"><span>…</span><strong>מפיק את הדוח</strong><small>מחשב שעות ומקשר מכירות למשמרות</small></section> : report && <>
      {view === "EMPLOYEES" && <section className="report-list employee-report-list">{report.employees.map(employee => <details key={employee.employeeId}>
        <summary><div><strong>{employee.employeeName}</strong><small>{employee.jobPosition} · {employee.assignedStation}</small></div><span><b>{minutesLabel(employee.totalMinutes)}</b><small>{employee.workDays} ימים</small></span><span><b>{money(employee.salaryCents / 100)}</b><small>לתשלום</small></span><i>⌄</i></summary>
        <div className="report-expanded"><dl><div><dt>שכר לשעה</dt><dd>{money(employee.hourlyRateCents / 100)}</dd></div><div><dt>זרים שנמכרו</dt><dd>{employee.salesQuantity}</dd></div><div><dt>סכום מכירות</dt><dd>{money(employee.salesAmountCents / 100)}</dd></div></dl><ProductBreakdown products={employee.products} /></div>
      </details>)}{!report.employees.length && <ReportEmpty />}</section>}
      {view === "SHIFTS" && <section className="report-list shift-report-list">{report.shifts.map(shift => <details key={shift.id}>
        <summary><div><strong>{shift.employeeName}</strong><small>{dateLabel(shift.date)} · {shift.station.name}</small></div><span><b>{minutesLabel(shift.durationMinutes)}</b><small>שעות</small></span><span><b>{shift.salesQuantity}</b><small>זרים</small></span><i>⌄</i></summary>
        <div className="report-expanded"><dl><div><dt>כניסה</dt><dd>{new Date(shift.clockIn).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>יציאה</dt><dd>{new Date(shift.clockOut).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>שכר משמרת</dt><dd>{money(shift.salaryCents / 100)}</dd></div><div><dt>מכירות</dt><dd>{money(shift.salesAmountCents / 100)}</dd></div></dl><div className="report-location"><span>⌖</span><div><b>{shift.station.name}</b><small>{shift.station.locationDescription || shift.station.address || "מיקום לפי קואורדינטות"}</small><em dir="ltr">{shift.station.latitude.toFixed(6)}, {shift.station.longitude.toFixed(6)}</em></div></div><ProductBreakdown products={shift.products} /></div>
      </details>)}{!report.shifts.length && <ReportEmpty />}</section>}
      {view === "PRODUCTS" && <section className="product-report-grid">{report.products.map(product => <article key={product.productId}><span>✿</span><div><strong>{product.productName}</strong><small>סה״כ בתקופה</small></div><b>{product.quantity}<small> זרים</small></b><em>{money(product.amountCents / 100)}</em></article>)}{!report.products.length && <ReportEmpty />}</section>}
    </>}

    {filtersOpen && <><button className="mobile-drawer-scrim report-filter-scrim" aria-label="סגירת מסנני הדוח" onClick={() => setFiltersOpen(false)} /><SwipeSheet className="report-filter-sheet" ariaLabel="מסנני דוח שכר ומכירות" onDismiss={() => setFiltersOpen(false)}>
      <header><div><strong>סינון הדוח</strong><small>בחרו תקופה, עובד או עמדה</small></div></header>
      <div className="report-filter-fields"><label>מתאריך<input type="date" value={draftFilters.from} max={draftFilters.to} onChange={event => setDraftFilters(value => ({ ...value, from: event.target.value }))} /></label><label>עד תאריך<input type="date" value={draftFilters.to} min={draftFilters.from} onChange={event => setDraftFilters(value => ({ ...value, to: event.target.value }))} /></label><label>עובד<select value={draftFilters.employeeId} onChange={event => setDraftFilters(value => ({ ...value, employeeId: event.target.value }))}><option value="ALL">כל העובדים</option>{employees.map(employee => <option value={employee.id} key={employee.id}>{employee.name}</option>)}</select></label><label>עמדה<select value={draftFilters.stationId} onChange={event => setDraftFilters(value => ({ ...value, stationId: event.target.value }))}><option value="ALL">כל העמדות</option>{stations.map(station => <option value={station.id} key={station.id}>{station.name}</option>)}</select></label></div>
      <div className="report-filter-actions"><button className="secondary" type="button" onClick={() => setDraftFilters(initialFilters())}>איפוס</button><button className="primary" type="button" onClick={applyFilters}>הפקת הדוח</button></div>
    </SwipeSheet></>}
  </div>;
}

function ProductBreakdown({ products }: { products: ProductReport[] }) {
  return <section className="report-products"><h3>מכירות לפי סוג זר</h3>{products.length ? products.map(product => <div key={product.productId}><span>{product.productName}</span><b>{product.quantity} יח׳</b><small>{money(product.amountCents / 100)}</small></div>) : <p>לא דווחו מכירות במשמרות שנבחרו.</p>}</section>;
}
function ReportEmpty() { return <article className="report-empty"><span>⌕</span><strong>אין נתונים בתקופה שנבחרה</strong><small>אפשר לשנות את התקופה או את מסנני העובד והעמדה</small></article>; }

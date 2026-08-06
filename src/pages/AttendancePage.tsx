import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { useBusinessData } from "../context/BusinessDataContext";

type AttendanceFilter = "ALL" | "ACTIVE" | "PENDING" | "APPROVED" | "REJECTED";
export function AttendancePage() {
  const navigate = useNavigate();
  const { employees, attendance, stations } = useBusinessData();
  const [filter, setFilter] = useState<AttendanceFilter>("ALL");
  const [stationId, setStationId] = useState("ALL");
  const activeIds = new Set(employees.filter(employee => employee.status === "במשמרת").map(employee => employee.id));
  const visible = useMemo(() => attendance.filter(record => {
    if (stationId !== "ALL" && record.stationId !== Number(stationId)) return false;
    if (filter === "ACTIVE") return activeIds.has(record.employeeId);
    if (filter !== "ALL") return record.exceptionStatus === filter;
    return true;
  }), [attendance, stationId, filter, activeIds]);
  const pending = attendance.filter(record => record.exceptionStatus === "PENDING").length;
  return <div className="attendance-page"><PageIntro title="נוכחות ומשמרות" text="רשומות זמן ומיקום כפי שנשמרו בשרת." />
    <section className="attendance-summary"><article><span>במשמרת</span><b>{activeIds.size}</b><small>עובדים</small></article><article><span>רשומות</span><b>{attendance.length}</b><small>סה״כ</small></article><button className={pending ? "warning" : ""} onClick={() => navigate("/exceptions")}><span>חריגות</span><b>{pending}</b><small>{pending ? "לטיפול" : "אין"}</small></button></section>
    <div className="attendance-filters" role="tablist">{([["ALL", "כולם"], ["ACTIVE", "במשמרת"], ["PENDING", "חריגות ממתינות"], ["APPROVED", "אושרו"], ["REJECTED", "נדחו"]] as const).map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="toolbar attendance-toolbar"><label>עמדה<select value={stationId} onChange={event => setStationId(event.target.value)}><option value="ALL">כל העמדות</option>{stations.map(station => <option value={station.id} key={station.id}>{station.name}</option>)}</select></label><span className="filter-result">{visible.length} רשומות</span></div>
    <section className="panel attendance-desktop-table"><DataTable headers={["עובד", "עמדה", "פעולה", "זמן שרת", "מרחק", "סטטוס", "פרטים"]} rows={visible.map(record => [
      <b key="n">{record.employee?.user.displayName ?? record.employeeId}</b>, record.station?.name ?? record.stationId,
      record.action === "CLOCK_IN" ? "כניסה" : "יציאה", new Date(record.serverTimestamp).toLocaleString("he-IL"), `${Math.round(record.distanceMeters)} מ׳`,
      <span className={`review-status ${record.exceptionStatus.toLowerCase()}`} key="s">{record.exceptionStatus === "PENDING" ? "ממתין לאישור" : record.exceptionStatus === "APPROVED" ? "אושר" : record.exceptionStatus === "REJECTED" ? "נדחה" : "תקין"}</span>,
      record.exceptional ? <button className="text-button" key="a" onClick={() => navigate("/exceptions")}>צפייה בחריגה</button> : <span key="a">—</span>,
    ])} /></section>
    <section className="attendance-mobile-list">{visible.map(record => {
      const recordedAt = new Date(record.serverTimestamp);
      const status = record.exceptionStatus === "PENDING" ? "ממתין לאישור" : record.exceptionStatus === "APPROVED" ? "אושר" : record.exceptionStatus === "REJECTED" ? "נדחה" : "תקין";
      return <article className={record.exceptionStatus === "PENDING" ? "pending" : ""} key={record.id}>
        <header><div><strong>{record.employee?.user.displayName ?? record.employeeId}</strong><small>{record.station?.name ?? `עמדה ${record.stationId}`}</small></div><span className={record.action === "CLOCK_IN" ? "clock-in" : "clock-out"}>{record.action === "CLOCK_IN" ? "כניסה" : "יציאה"}</span></header>
        <div className="attendance-card-meta"><span><b>{recordedAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</b><small>{recordedAt.toLocaleDateString("he-IL")}</small></span><span><b>{Math.round(record.distanceMeters).toLocaleString("he-IL")} מ׳</b><small>מהעמדה</small></span><span className={`review-status ${record.exceptionStatus.toLowerCase()}`}>{status}</span></div>
        {record.exceptional && <button onClick={() => navigate("/exceptions")}>צפייה בחריגה ←</button>}
      </article>;
    })}{!visible.length && <div className="panel empty-state">אין רשומות התואמות לסינון.</div>}</section>
  </div>;
}

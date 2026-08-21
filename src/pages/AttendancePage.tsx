import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageIntro } from "../components/PageIntro";
import { AttendanceShiftModal } from "../components/AttendanceShiftModals";
import { ShiftDayGroups } from "../components/ShiftDayGroups";
import { useBusinessData } from "../context/BusinessDataContext";
import type { ApiAttendance, AttendanceShiftView } from "../context/BusinessDataContext";

type AttendanceFilter = "ALL" | "ACTIVE" | "PENDING" | "APPROVED" | "REJECTED";
export function AttendancePage() {
  const navigate = useNavigate();
  const { employees, attendance, stations, refresh, attendanceShiftSummary } = useBusinessData();
  const [shiftAction, setShiftAction] = useState<{ mode: "EDIT" | "DELETE"; clockIn: ApiAttendance; clockOut: ApiAttendance | null } | null>(null);
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
  const visibleShiftSummary = useMemo(() => {
    const allowedClockIns = new Set(visible.filter(record => record.action === "CLOCK_IN").map(record => record.id));
    const days = attendanceShiftSummary.days.map(day => ({ ...day, shifts: day.shifts.filter(shift => allowedClockIns.has(shift.clockInId)) })).filter(day => day.shifts.length).map(day => ({
      ...day,
      dailyMinutes: day.shifts.filter(shift => shift.includedInTotals).reduce((sum, shift) => sum + (shift.durationMinutes ?? 0), 0),
      dailyPayCents: day.shifts.filter(shift => shift.includedInTotals).reduce((sum, shift) => sum + (shift.shiftPayCents ?? 0), 0),
    }));
    const shifts = days.flatMap(day => day.shifts).filter(shift => shift.includedInTotals);
    return { days, summary: { totalShifts: shifts.length, totalMinutes: shifts.reduce((sum, shift) => sum + (shift.durationMinutes ?? 0), 0), totalPayCents: shifts.reduce((sum, shift) => sum + (shift.shiftPayCents ?? 0), 0) } };
  }, [attendanceShiftSummary, visible]);
  function openShiftAction(mode: "EDIT" | "DELETE", shift: AttendanceShiftView) {
    const clockIn = attendance.find(record => record.id === shift.clockInId);
    if (!clockIn) return;
    const clockOut = shift.clockOutId ? attendance.find(record => record.id === shift.clockOutId) ?? null : null;
    setShiftAction({ mode, clockIn, clockOut });
  }
  return <div className="attendance-page"><PageIntro title="נוכחות ומשמרות" text="רשומות זמן ומיקום כפי שנשמרו בשרת." />
    <section className="attendance-summary"><article><span>במשמרת</span><b>{activeIds.size}</b><small>עובדים</small></article><article><span>רשומות</span><b>{attendance.length}</b><small>סה״כ</small></article><button className={pending ? "warning" : ""} onClick={() => navigate("/exceptions")}><span>חריגות</span><b>{pending}</b><small>{pending ? "לטיפול" : "אין"}</small></button></section>
    <div className="attendance-filters" role="tablist">{([["ALL", "כולם"], ["ACTIVE", "במשמרת"], ["PENDING", "חריגות ממתינות"], ["APPROVED", "אושרו"], ["REJECTED", "נדחו"]] as const).map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="toolbar attendance-toolbar"><label>עמדה<select value={stationId} onChange={event => setStationId(event.target.value)}><option value="ALL">כל העמדות</option>{stations.map(station => <option value={station.id} key={station.id}>{station.name}</option>)}</select></label><span className="filter-result">{visible.length} רשומות</span></div>
    <section className="attendance-shift-summary"><article><small>משמרות בחודש</small><b>{visibleShiftSummary.summary.totalShifts}</b></article><article><small>שעות בחודש</small><b>{(visibleShiftSummary.summary.totalMinutes / 60).toFixed(2)}</b></article><article><small>שכר חודשי</small><b>{(visibleShiftSummary.summary.totalPayCents / 100).toFixed(2)} ₪</b></article></section>
    <ShiftDayGroups value={visibleShiftSummary} showEmployee onEdit={shift => openShiftAction("EDIT", shift)} onDelete={shift => openShiftAction("DELETE", shift)} />
    {shiftAction && <AttendanceShiftModal {...shiftAction} stations={stations} onClose={() => setShiftAction(null)} onSaved={refresh} />}
  </div>;
}

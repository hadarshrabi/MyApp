import { useMemo } from "react";
import { useBusinessData, type ApiAttendance } from "../context/BusinessDataContext";

type Shift = { inRecord: ApiAttendance; outRecord?: ApiAttendance; minutes: number };

export function EmployeeHistoryPage() {
  const { attendance, employeeProfile } = useBusinessData();
  const shifts = useMemo(() => {
    const ordered = [...attendance].filter(record => record.exceptionStatus !== "REJECTED").sort((a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime());
    const result: Shift[] = [];
    for (let index = 0; index < ordered.length; index += 1) {
      if (ordered[index].action !== "CLOCK_OUT") continue;
      const inRecord = ordered.slice(index + 1).find(record => record.action === "CLOCK_IN");
      if (!inRecord) continue;
      result.push({ inRecord, outRecord: ordered[index], minutes: Math.max(0, (new Date(ordered[index].serverTimestamp).getTime() - new Date(inRecord.serverTimestamp).getTime()) / 60000) });
    }
    const open = ordered.find(record => record.action === "CLOCK_IN");
    if (open && ordered[0]?.id === open.id) result.unshift({ inRecord: open, minutes: 0 });
    return result.slice(0, 20);
  }, [attendance]);
  const hours = (employeeProfile?.totalMinutes ?? 0) / 60;

  return <div className="employee-history-page">
    <header><span>מידע אישי לקריאה בלבד</span><h1>המשמרות והשכר שלי</h1></header>
    <section className="employee-pay-summary"><article><small>שעות מתועדות</small><strong>{hours.toFixed(2)}</strong></article><article><small>שכר לשעה</small><strong>{((employeeProfile?.hourlyRateCents ?? 0) / 100).toFixed(2)} ₪</strong></article><article><small>סכום מחושב</small><strong>{((employeeProfile?.estimatedPayCents ?? 0) / 100).toFixed(2)} ₪</strong></article></section>
    <p className="employee-readonly-note">הנתונים מחושבים מרישומי השרת. רק מנהל יכול לבצע תיקונים.</p>
    <section className="employee-shift-history"><h2>היסטוריית משמרות</h2>{shifts.map(shift => <article key={shift.inRecord.id}><div><b>{new Date(shift.inRecord.serverTimestamp).toLocaleDateString("he-IL")}</b><small>{shift.inRecord.station?.name}</small></div><dl><div><dt>כניסה</dt><dd>{formatTime(shift.inRecord.serverTimestamp)}</dd></div><div><dt>יציאה</dt><dd>{shift.outRecord ? formatTime(shift.outRecord.serverTimestamp) : "במשמרת"}</dd></div><div><dt>סה״כ</dt><dd>{shift.outRecord ? `${Math.floor(shift.minutes / 60)}:${String(Math.round(shift.minutes % 60)).padStart(2, "0")}` : "—"}</dd></div></dl></article>)}{!shifts.length && <p>עדיין אין משמרות להצגה.</p>}</section>
  </div>;
}

function formatTime(value: string) { return new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }

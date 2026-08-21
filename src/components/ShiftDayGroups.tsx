import type { AttendanceShiftSummary, AttendanceShiftView } from "../context/BusinessDataContext";

type Props = {
  value: AttendanceShiftSummary;
  showEmployee?: boolean;
  onEdit?: (shift: AttendanceShiftView) => void;
  onDelete?: (shift: AttendanceShiftView) => void;
};

const money = (cents: number) => `${(cents / 100).toFixed(2)} ₪`;
const duration = (minutes: number | null) => minutes === null ? "—" : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
const time = (value: string | null) => value ? new Date(value).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }) : "במשמרת";
const date = (value: string) => { const [year, month, day] = value.split("-"); return `${day}.${month}.${year}`; };

export function ShiftDayGroups({ value, showEmployee = false, onEdit, onDelete }: Props) {
  return <section className="shift-day-groups">
    {value.days.map(day => <article className="shift-day" key={day.date}>
      <header><h3>{date(day.date)}</h3><span>{day.shifts.length} משמרות</span></header>
      <div className="shift-day-list">{day.shifts.map(shift => <section className="shift-pay-card" key={shift.id}>
        <div className="shift-pay-heading"><div>{showEmployee && <strong>{shift.employeeName}</strong>}<span>{shift.station.name}</span></div><i className={shift.status.toLowerCase()}>{shift.status === "OPEN" ? "במשמרת" : shift.status === "PENDING" ? "ממתין לאישור" : "הושלמה"}</i></div>
        <dl><div><dt>כניסה</dt><dd>{time(shift.clockIn)}</dd></div><div><dt>יציאה</dt><dd>{time(shift.clockOut)}</dd></div><div><dt>משך</dt><dd>{duration(shift.durationMinutes)}</dd></div><div><dt>שכר שעתי</dt><dd>{money(shift.hourlyRateCents)}</dd></div><div className="shift-pay-total"><dt>לתשלום למשמרת</dt><dd>{shift.shiftPayCents === null ? "טרם חושב" : money(shift.shiftPayCents)}</dd></div></dl>
        {(onEdit || onDelete) && <div className="shift-pay-actions">{onEdit && <button onClick={() => onEdit(shift)}>עריכת שעות</button>}{onDelete && <button className="danger" onClick={() => onDelete(shift)}>מחיקת משמרת</button>}</div>}
      </section>)}</div>
      <footer><span>סה״כ ליום</span><b>{duration(day.dailyMinutes)} · {money(day.dailyPayCents)}</b></footer>
    </article>)}
    {!value.days.length && <div className="panel empty-state">אין משמרות להצגה.</div>}
  </section>;
}

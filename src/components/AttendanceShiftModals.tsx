import { useMemo, useRef, useState, type PointerEvent } from "react";
import { apiClient } from "../services/apiClient";
import type { ApiAttendance } from "../context/BusinessDataContext";
import type { Station } from "../types/models";

type Props = { mode: "EDIT" | "DELETE"; clockIn: ApiAttendance; clockOut: ApiAttendance | null; stations: Station[]; onClose: () => void; onSaved: () => Promise<void> };

const israelTimeZone = "Asia/Jerusalem";
const israelPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: israelTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const israelOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: israelTimeZone, timeZoneName: "longOffset",
});

function israelDateTimeParts(value: string) {
  const parts = Object.fromEntries(israelPartsFormatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function israelOffsetMilliseconds(instant: Date) {
  const offset = israelOffsetFormatter.formatToParts(instant).find(part => part.type === "timeZoneName")?.value;
  const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error("לא ניתן לחשב את אזור הזמן של ישראל");
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "+" ? minutes : -minutes) * 60_000;
}

function israelLocalToIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(localWallTime);
  for (let iteration = 0; iteration < 2; iteration += 1) instant = new Date(localWallTime - israelOffsetMilliseconds(instant));
  return instant.toISOString();
}

export function formatDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "—";
}

export function formatDisplayTime(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : "—";
}

function PickerControl({ type, value, onChange }: { type: "date" | "time"; value: string; onChange: (value: string) => void }) {
  const displayValue = type === "date" ? formatDisplayDate(value) : formatDisplayTime(value);
  return <span className="attendance-picker-control">
    <span className="attendance-picker-value" aria-hidden="true">{displayValue}</span>
    <input className={`attendance-picker-native ${type === "date" ? "attendance-date-input" : "attendance-time-input"}`} type={type} dir="ltr" value={value} onChange={event => onChange(event.target.value)} />
  </span>;
}

export function AttendanceShiftModal({ mode, clockIn, clockOut, stations, onClose, onSaved }: Props) {
  const initialClockIn = israelDateTimeParts(clockIn.serverTimestamp);
  const initialClockOut = clockOut ? israelDateTimeParts(clockOut.serverTimestamp) : { date: "", time: "" };
  const [clockInDate, setClockInDate] = useState(initialClockIn.date);
  const [clockInTime, setClockInTime] = useState(initialClockIn.time);
  const [clockOutDate, setClockOutDate] = useState(initialClockOut.date);
  const [clockOutTime, setClockOutTime] = useState(initialClockOut.time);
  const [stationId, setStationId] = useState(clockIn.stationId);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dragStartY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const employeeName = clockIn.employee?.user.displayName ?? "העובד";
  const clockInAt = useMemo(() => israelLocalToIso(clockInDate, clockInTime), [clockInDate, clockInTime]);
  const clockOutAt = useMemo(() => israelLocalToIso(clockOutDate, clockOutTime), [clockOutDate, clockOutTime]);
  const clockOutComplete = !clockOutDate && !clockOutTime || !!clockOutAt;
  const durationHours = useMemo(() => clockOutAt && clockInAt ? (new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 3600000 : 0, [clockInAt, clockOutAt]);
  const valid = reason.trim().length >= 5 && (mode === "DELETE" || (!!clockInAt && clockOutComplete && (!clockOutAt || new Date(clockOutAt) > new Date(clockInAt))));
  function startMobileDrag(event: PointerEvent<HTMLDivElement>) {
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    dragStartY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveMobileDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragOffset(Math.max(0, event.clientY - dragStartY.current));
  }
  function finishMobileDrag() {
    if (!dragging) return;
    setDragging(false);
    if (dragOffset >= 90) onClose();
    else setDragOffset(0);
  }
  async function submit() {
    if (!valid || saving) return;
    setSaving(true); setError("");
    try {
      if (mode === "DELETE") await apiClient.delete(`/api/admin/attendance/shifts/${clockIn.id}`, { reason: reason.trim(), confirmation: true });
      else await apiClient.patch(`/api/admin/attendance/shifts/${clockIn.id}`, { clockInAt: new Date(clockInAt).toISOString(), clockOutAt: clockOutAt ? new Date(clockOutAt).toISOString() : null, stationId, reason: reason.trim() });
      await onSaved(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "לא ניתן להשלים את הפעולה"); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop attendance-shift-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal attendance-shift-modal ${mode === "DELETE" ? "delete" : "edit"}${dragging ? " attendance-shift-dragging" : ""}`} style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined} role="dialog" aria-modal="true" aria-labelledby="attendance-shift-title">
      <div className="attendance-shift-drag-handle" role="button" tabIndex={0} aria-label="גרירה מטה לסגירה" onPointerDown={startMobileDrag} onPointerMove={moveMobileDrag} onPointerUp={finishMobileDrag} onPointerCancel={finishMobileDrag} onKeyDown={event => { if (event.key === "Escape") onClose(); }}><span /></div>
      <button className="modal-close" type="button" onClick={onClose} aria-label="סגירה">×</button>
      <h2 id="attendance-shift-title">{mode === "DELETE" ? "מחיקת רשומת נוכחות" : "עריכת שעות נוכחות"}</h2>
      {mode === "DELETE" ? <p className="attendance-delete-warning">הפעולה תמחק לוגית את המשמרת של <b>{employeeName}</b> מ־{new Date(clockIn.serverTimestamp).toLocaleDateString("he-IL")}. הפעולה תשפיע על שעות העבודה, דוחות וחישובי שכר.</p> : <div className="attendance-shift-summary"><span>עובד</span><b>{employeeName}</b><span>תאריך</span><b>{new Date(clockInAt).toLocaleDateString("he-IL", { timeZone: israelTimeZone })}</b></div>}
      {mode === "EDIT" && <div className="attendance-shift-fields">
        <fieldset className="attendance-date-time-group"><legend>כניסה</legend><div className="attendance-date-time-pair">
          <label>תאריך<PickerControl type="date" value={clockInDate} onChange={setClockInDate} /></label>
          <label>שעה<PickerControl type="time" value={clockInTime} onChange={setClockInTime} /></label>
        </div></fieldset>
        <fieldset className="attendance-date-time-group"><legend>יציאה</legend><div className="attendance-date-time-pair">
          <label>תאריך<PickerControl type="date" value={clockOutDate} onChange={setClockOutDate} /></label>
          <label>שעה<PickerControl type="time" value={clockOutTime} onChange={setClockOutTime} /></label>
          <small>{!clockOut ? "אפשר להשאיר תאריך ושעה ריקים למשמרת פתוחה" : "שעת היציאה הקיימת"}</small>
        </div></fieldset>
        <label className="attendance-station-field">עמדה<select value={stationId} onChange={event => setStationId(Number(event.target.value))}>{stations.map(station => <option value={station.id} key={station.id}>{station.name}</option>)}</select></label>
        {durationHours > 16 && <div className="attendance-duration-warning" role="status">לתשומת לבך: משך המשמרת ארוך מ־16 שעות. ניתן לשמור, אך מומלץ לבדוק את השעות.</div>}
      </div>}
      <label>{mode === "DELETE" ? "סיבת מחיקה" : "סיבת תיקון"}<textarea value={reason} minLength={5} maxLength={500} required onChange={event => setReason(event.target.value)} placeholder={mode === "DELETE" ? "לדוגמה: דיווח כפול" : "לדוגמה: תיקון דיווח"} /></label>
      {error && <div className="user-form-error" role="alert">{error}</div>}
      <div className="attendance-shift-actions"><button className="secondary" type="button" disabled={saving} onClick={onClose}>ביטול</button><button className={mode === "DELETE" ? "attendance-delete-confirm" : "primary"} type="button" disabled={!valid || saving} onClick={() => void submit()}>{saving ? "שומר…" : mode === "DELETE" ? "מחיקת הרשומה" : "שמירת שינוי"}</button></div>
    </section>
  </div>;
}

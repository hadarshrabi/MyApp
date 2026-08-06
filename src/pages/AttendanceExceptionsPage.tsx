import { useMemo, useState } from "react";
import { AttendanceExceptionMap } from "../components/AttendanceExceptionMap";
import { PageIntro } from "../components/PageIntro";
import { useAttendanceExceptions } from "../context/AttendanceExceptionsContext";
import type { ApiAttendance } from "../context/BusinessDataContext";

const statusLabels = { PENDING: "ממתין לאישור", APPROVED: "אושר", REJECTED: "נדחה", NONE: "ללא חריגה" };

export function AttendanceExceptionsPage() {
  const { records, loading, approve, reject } = useAttendanceExceptions();
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [selected, setSelected] = useState<ApiAttendance | null>(null);
  const [rejecting, setRejecting] = useState<ApiAttendance | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const visible = useMemo(() => filter === "ALL" ? records : records.filter(record => record.exceptionStatus === filter), [records, filter]);
  const counts = useMemo(() => ({
    all: records.length,
    pending: records.filter(record => record.exceptionStatus === "PENDING").length,
    approved: records.filter(record => record.exceptionStatus === "APPROVED").length,
    rejected: records.filter(record => record.exceptionStatus === "REJECTED").length,
  }), [records]);

  async function doApprove(record: ApiAttendance) {
    setBusy(record.id);
    try { await approve(record.id); if (selected?.id === record.id) setSelected(null); }
    finally { setBusy(""); }
  }
  async function doReject() {
    if (!rejecting || reason.trim().length < 3) return;
    setBusy(rejecting.id);
    try { await reject(rejecting.id, reason.trim()); setRejecting(null); setSelected(null); setReason(""); }
    finally { setBusy(""); }
  }

  return <div className="attendance-page exceptions-page"><PageIntro title="חריגות נוכחות" text="דיווחי נוכחות שנרשמו מחוץ לטווח העמדה וממתינים לבדיקת מנהל." />
    <section className="attendance-summary exception-summary" aria-label="סיכום חריגות נוכחות">
      <article className={counts.pending ? "warning" : ""}><span>ממתינות</span><b>{counts.pending}</b><small>{counts.pending ? "לטיפול" : "אין"}</small></article>
      <article><span>אושרו</span><b>{counts.approved}</b><small>דיווחים</small></article>
      <article><span>נדחו</span><b>{counts.rejected}</b><small>דיווחים</small></article>
    </section>
    <div className="attendance-filters exception-tabs" role="tablist" aria-label="סינון חריגות">
      {([["ALL", "הכול"], ["PENDING", "ממתינות"], ["APPROVED", "אושרו"], ["REJECTED", "נדחו"]] as const).map(([value, label]) =>
        <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}<span>{value === "ALL" ? counts.all : value === "PENDING" ? counts.pending : value === "APPROVED" ? counts.approved : counts.rejected}</span></button>)}
    </div>
    {loading && !records.length ? <section className="attendance-empty exceptions-empty loading"><span>…</span><strong>טוען חריגות</strong><small>הנתונים מתעדכנים מהמערכת</small></section> :
      <section className="exceptions-list">{visible.map(record => {
        const allowed = record.station?.allowedRadiusMeters ?? 150;
        const recordedAt = new Date(record.serverTimestamp);
        return <article className={`exception-card ${record.exceptionStatus.toLowerCase()}`} key={record.id}>
          <div className="exception-main"><div className="exception-title"><span className="exception-icon">!</span><div><h3>{record.employee?.user.displayName ?? "עובד"}</h3><p>{record.employee?.jobPosition || "עובד"} · {record.station?.name || "עמדה לא ידועה"}</p></div><span className={`review-status ${record.exceptionStatus.toLowerCase()}`}>{statusLabels[record.exceptionStatus]}</span></div>
            <div className="exception-kind"><span>{record.action === "CLOCK_IN" ? "כניסה" : "יציאה"}</span><small>דיווח נוכחות חריג</small></div>
            <dl className="exception-metrics"><div><dt>זמן הדיווח</dt><dd><b>{recordedAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</b><small>{recordedAt.toLocaleDateString("he-IL")}</small></dd></div><div><dt>מרחק מהעמדה</dt><dd><b>{Math.round(record.distanceMeters).toLocaleString("he-IL")}</b><small>מטר</small></dd></div><div><dt>מעל הרדיוס המותר</dt><dd><b>{Math.max(0, Math.round(record.distanceMeters - allowed)).toLocaleString("he-IL")}</b><small>מטר</small></dd></div></dl>
          </div>
          <div className="exception-actions"><button className="secondary" onClick={() => setSelected(record)}>צפייה בפרטים</button>{record.exceptionStatus === "PENDING" && <><button className="approve-button" disabled={busy === record.id} onClick={() => void doApprove(record)}>אישור</button><button className="reject-button" disabled={busy === record.id} onClick={() => setRejecting(record)}>דחייה</button></>}</div>
        </article>;
      })}{!visible.length && <article className="attendance-empty exceptions-empty"><span>✓</span><strong>{filter === "PENDING" ? "אין חריגות שממתינות לאישור" : "אין חריגות בסינון שנבחר"}</strong><small>{filter === "PENDING" ? "כל דיווחי הנוכחות טופלו" : "אפשר לבחור סינון אחר כדי לראות דיווחים נוספים"}</small></article>}</section>}
    {selected && <div className="modal-backdrop"><section className="modal exception-details"><button className="modal-close" onClick={() => setSelected(null)} aria-label="סגירה">×</button><h2>פרטי חריגת נוכחות</h2>
      <AttendanceExceptionMap record={selected} /><dl><div><dt>עובד</dt><dd>{selected.employee?.user.displayName}</dd></div><div><dt>תפקיד</dt><dd>{selected.employee?.jobPosition}</dd></div><div><dt>עמדה</dt><dd>{selected.station?.name}</dd></div><div><dt>קואורדינטות</dt><dd dir="ltr">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd></div><div><dt>דיוק GPS</dt><dd>{selected.gpsAccuracy ? `${Math.round(selected.gpsAccuracy)} מטרים` : "לא דווח"}</dd></div><div><dt>מרחק</dt><dd>{Math.round(selected.distanceMeters)} מטרים</dd></div><div><dt>רדיוס מותר</dt><dd>{selected.station?.allowedRadiusMeters ?? 150} מטרים</dd></div><div><dt>מכשיר</dt><dd>{selected.deviceInfo ?? "לא דווח"}</dd></div></dl>
      {selected.exceptionStatus === "PENDING" && <div className="exception-actions"><button className="approve-button" onClick={() => void doApprove(selected)}>אישור</button><button className="reject-button" onClick={() => setRejecting(selected)}>דחייה</button></div>}</section></div>}
    {rejecting && <div className="modal-backdrop"><section className="modal reject-sheet"><button className="modal-close" onClick={() => setRejecting(null)} aria-label="סגירה">×</button><h2>דחיית חריגת נוכחות</h2><p>חובה להזין סיבה. הרשומה המקורית והמיקום יישמרו ללא שינוי.</p><label>סיבת הדחייה<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={3} required placeholder="הסיבה לדחיית הדיווח" /></label><div><button className="secondary" onClick={() => setRejecting(null)}>ביטול</button><button className="reject-button" disabled={reason.trim().length < 3 || busy === rejecting.id} onClick={() => void doReject()}>דחיית הדיווח</button></div></section></div>}
  </div>;
}

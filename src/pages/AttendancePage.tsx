import { useState } from "react";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { employees, stations } from "../data/mockData";
import { useAttendance } from "../hooks/useAttendance";
import { useApp } from "../context/AppContext";

export function AttendancePage() {
  const { clock, loading } = useAttendance();
  const { notify } = useApp();
  const [clocked, setClocked] = useState(true);
  async function handleClock() {
    try {
      const record = await clock("emp-1", stations[0], clocked ? "יציאה" : "כניסה");
      if (!record.approved) return notify(`הדיווח נדחה: המרחק מהעמדה הוא ${record.distanceMeters} מטרים`);
      setClocked(!clocked); notify(`${record.action} נרשמה בהצלחה עם מיקום`);
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לבצע דיווח"); }
  }
  return <><PageIntro title="נוכחות ומשמרות" text="מעקב אחר כניסות, יציאות ושעות העבודה של כל עובד." action="הוספת משמרת" />
    <div className="attendance-clock"><div><span className={clocked ? "pulse" : ""} /><div><b>{clocked ? "המשמרת שלך פעילה" : "אין משמרת פעילה"}</b><small>עמדת עזריאלי · רדיוס מאושר 150 מטרים</small></div></div><button onClick={handleClock} disabled={loading}>{loading ? "בודק מיקום…" : clocked ? "דיווח יציאה" : "דיווח כניסה"}</button></div>
    <section className="mini-stats"><article><span>נוכחים כעת</span><b>12 עובדים</b></article><article><span>שעות עבודה היום</span><b>74:35 שעות</b></article><article><span>חריגות לאישור</span><b>2 חריגות</b></article></section>
    <section className="panel"><DataTable headers={["עובד", "עמדה", "תפקיד במשמרת", "כניסה", "יציאה", "סה״כ", "מצב"]} rows={employees.slice(0, 4).map(employee => [<b key="n">{employee.name}</b>, employee.station, employee.role, employee.start, "—", employee.hours, <span className="pill good" key="s">משמרת פעילה</span>])} /></section>
  </>;
}

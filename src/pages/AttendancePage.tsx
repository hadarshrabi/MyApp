import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { employees } from "../data/mockData";
import { useApp } from "../context/AppContext";

export function AttendancePage() {
  const { openModal } = useApp();
  return <><PageIntro title="נוכחות ומשמרות" text="מעקב, תיקון ואישור דיווחי הנוכחות של כל העובדים." action="הוספת משמרת ידנית" />
    <section className="mini-stats"><article><span>נוכחים כעת</span><b>12 עובדים</b></article><article><span>שעות עבודה היום</span><b>74:35 שעות</b></article><article><span>חריגות לאישור</span><b>2 חריגות</b></article></section>
    <div className="toolbar"><label>תאריך<input type="date" defaultValue="2026-07-27" /></label><label>עמדה<select><option>כל העמדות</option><option>עזריאלי</option><option>שרונה</option></select></label><button className="secondary">הצגת נתונים</button></div>
    <section className="panel"><DataTable headers={["עובד", "עמדה", "תפקיד במשמרת", "כניסה", "יציאה", "סה״כ", "פעולות"]} rows={employees.slice(0, 4).map(employee => [
      <b key="n">{employee.name}</b>, employee.station, employee.role, employee.start, "—", employee.hours,
      <button className="text-button" key="a" onClick={() => openModal("תיקון רשומת נוכחות")}>תיקון מתועד</button>,
    ])} /></section>
    <p className="audit-note">כל שינוי ידני מחייב סיבה ונשמר בהיסטוריית הביקורת יחד עם הערך המקורי, הערך החדש וזהות המנהל.</p>
  </>;
}

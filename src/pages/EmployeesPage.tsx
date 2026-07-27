import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { employees } from "../data/mockData";
import { useApp } from "../context/AppContext";
import { money } from "../utils/format";

export function EmployeesPage() {
  const { openModal } = useApp();
  return <><PageIntro title="ניהול עובדים" text="פרטי העובדים, תפקידים, שכר ושיוך לעמדות." action="הוספת עובד" />
    <div className="toolbar"><label>חיפוש עובד<input placeholder="הקלדת שם העובד" /></label><label>סינון לפי תפקיד<select><option>כל התפקידים</option><option>מוכר או מוכרת</option><option>שוזר או שוזרת</option><option>אחמ״ש</option></select></label><button className="secondary">סינון</button></div>
    <section className="panel"><DataTable headers={["עובד", "תפקיד", "עמדה קבועה", "שכר לשעה", "מצב", "פעולות"]} rows={employees.map(employee => [<b key="n">{employee.name}</b>, employee.role, employee.station, money(employee.hourlyRate), <span className={employee.status === "במשמרת" ? "pill good" : "pill"} key="s">{employee.status}</span>, <button className="text-button" key="a" onClick={() => openModal("עריכת עובד")}>עריכה</button>])} /></section>
  </>;
}

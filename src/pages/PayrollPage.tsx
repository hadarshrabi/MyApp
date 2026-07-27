import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { employees } from "../data/mockData";
import { payrollService } from "../services/payrollService";
import { money } from "../utils/format";

export function PayrollPage() {
  return <><PageIntro title="שכר ודוחות" text="חישוב שעות וסכום לתשלום לפי עובד ותקופה." action="הפקת דוח שכר" />
    <section className="mini-stats"><article><span>סה״כ לתשלום החודש</span><b>86,420 ₪</b></article><article><span>שעות שדווחו</span><b>1,764 שעות</b></article><article><span>עובדים בדוח</span><b>24 עובדים</b></article></section>
    <div className="toolbar"><label>תקופת שכר<select><option>יולי 2026</option><option>יוני 2026</option></select></label><button className="secondary">ייצוא לגיליון</button></div>
    <section className="panel"><DataTable headers={["עובד", "תפקיד", "שעות רגילות", "שעות נוספות", "שכר לשעה", "סכום לתשלום"]} rows={employees.map((employee, index) => { const regular = 128 + index * 7; const overtime = index + 2.5; return [<b key="n">{employee.name}</b>, employee.role, `${regular}:00`, `${overtime}:30`, money(employee.hourlyRate), <b key="m">{money(payrollService.calculate(employee, regular, overtime))}</b>]; })} /></section>
  </>;
}

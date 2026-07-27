import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";

export function UsersPage() {
  return <><PageIntro title="משתמשים והרשאות" text="שני תפקידי מערכת בלבד: מנהל ועובד." action="הזמנת משתמש" />
    <section className="permission-grid two-roles"><article className="panel role-card"><i>♚</i><h3>מנהל</h3><p>גישה מלאה לעובדים, נוכחות, שכר, מלאי, משתמשים, הגדרות והיסטוריית ביקורת.</p><b>משתמש אחד</b></article><article className="panel role-card"><i>♙</i><h3>עובד</h3><p>כניסה ויציאה אמיתיות, דיווח מכירה וצפייה בנתונים האישיים ובמלאי העמדה.</p><b>19 משתמשים</b></article></section>
    <section className="panel"><DataTable headers={["משתמש", "תפקיד מערכת", "תפקיד בעסק", "גישה לעמדה", "מצב", "פעולות"]} rows={[[<b key="1">לינוי רז</b>, "מנהל", "בעלת העסק", "כל העמדות", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>], [<b key="2">מיה אדרי</b>, "עובד", "מוכרת", "עזריאלי", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>], [<b key="3">נועה כהן</b>, "עובד", "שוזרת", "דיזנגוף", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>]]} /></section>
  </>;
}

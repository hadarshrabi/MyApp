import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";

export function UsersPage() {
  return <><PageIntro title="משתמשים והרשאות" text="שליטה בגישה למערכת לפי משתמש ותפקיד." action="הזמנת משתמש" />
    <section className="permission-grid"><article className="panel role-card"><i>♚</i><h3>מנהל ראשי</h3><p>גישה מלאה לכל העמדות, העובדים, השכר וההגדרות.</p><b>משתמש אחד</b></article><article className="panel role-card"><i>♜</i><h3>מנהל עמדה</h3><p>ניהול עובדים ומלאי בעמדות שהוקצו למשתמש.</p><b>4 משתמשים</b></article><article className="panel role-card"><i>♙</i><h3>עובד</h3><p>כניסה ויציאה, צפייה במשמרות ועדכון מלאי מורשה.</p><b>19 משתמשים</b></article></section>
    <section className="panel"><DataTable headers={["משתמש", "תפקיד במערכת", "גישה לעמדות", "מצב", "פעולות"]} rows={[[<b key="1">לינוי רז</b>, "מנהל ראשי", "כל העמדות", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>], [<b key="2">דניאל ישראלי</b>, "מנהל עמדה", "שרונה ועזריאלי", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>], [<b key="3">נועה כהן</b>, "עובדת", "דיזנגוף", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>]]} /></section>
  </>;
}

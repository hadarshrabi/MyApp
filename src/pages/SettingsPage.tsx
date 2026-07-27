import { useState, type FormEvent } from "react";
import { PageIntro } from "../components/PageIntro";
import { useApp } from "../context/AppContext";

export function SettingsPage() {
  const [role, setRole] = useState("מוכרת");
  const { notify } = useApp();
  function submit(event: FormEvent) { event.preventDefault(); notify("ההגדרות נשמרו בהצלחה"); }
  return <><PageIntro title="הגדרות" text="פרטי העסק, כללי דיווח והעדפות המערכת." /><form className="settings-grid" onSubmit={submit}>
    <section className="panel form-card"><h3>פרטי העסק</h3><label>שם העסק<input defaultValue="לינוי עיצובים" /></label><label>מספר טלפון<input defaultValue="03-5551234" /></label><label>כתובת משרד<input defaultValue="תל אביב" /></label></section>
    <section className="panel form-card"><h3>הגדרות נוכחות</h3><label>מרחק מותר מהעמדה<select><option>עד 150 מטרים</option><option>עד 300 מטרים</option></select></label><label className="check"><input type="checkbox" defaultChecked /> דרישת מיקום בעת כניסה</label><label className="check"><input type="checkbox" defaultChecked /> שליחת התראה על חריגה</label></section>
    <section className="panel form-card"><h3>תפקידים ותעריפים</h3><label>תפקיד<select value={role} onChange={event => setRole(event.target.value)}><option>מוכרת</option><option>שוזרת</option><option>אחמ״ש</option></select></label><label>תעריף ברירת מחדל<input type="number" defaultValue="42" /></label><button type="button" className="secondary" onClick={() => notify("התפקיד נוסף לרשימה")}>הוספת תפקיד חדש</button></section>
    <div className="settings-actions"><button className="primary" type="submit">שמירת הגדרות</button><button className="secondary" type="button">ביטול שינויים</button></div>
  </form></>;
}

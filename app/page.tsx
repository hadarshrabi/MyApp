"use client";

import { FormEvent, useMemo, useState } from "react";

type Stand = { id: number; name: string; address: string; stock: number; target: number; revenue: number; status: "פתוחה" | "דורשת טיפול" };
type Worker = { initials: string; name: string; stand: string; role: string; start: string; hours: string; rate: number; status: string; color: string };

const initialStands: Stand[] = [
  { id: 1, name: "עמדת עזריאלי", address: "דרך מנחם בגין 132, תל אביב", stock: 38, target: 45, revenue: 4260, status: "פתוחה" },
  { id: 2, name: "עמדת שרונה", address: "אלוף קלמן מגן 3, תל אביב", stock: 12, target: 40, revenue: 3180, status: "דורשת טיפול" },
  { id: 3, name: "עמדת דיזנגוף", address: "דיזנגוף 50, תל אביב", stock: 29, target: 35, revenue: 2840, status: "פתוחה" },
  { id: 4, name: "עמדת רמת אביב", address: "איינשטיין 40, תל אביב", stock: 33, target: 40, revenue: 2560, status: "פתוחה" },
];

const workers: Worker[] = [
  { initials: "מע", name: "מיה אדרי", stand: "עזריאלי", role: "מוכרת", start: "08:02", hours: "6:13", rate: 42, status: "במשמרת", color: "lavender" },
  { initials: "די", name: "דניאל ישראלי", stand: "שרונה", role: "אחמ״ש", start: "09:15", hours: "5:00", rate: 55, status: "במשמרת", color: "mint" },
  { initials: "נכ", name: "נועה כהן", stand: "דיזנגוף", role: "שוזרת", start: "10:01", hours: "4:14", rate: 48, status: "במשמרת", color: "peach" },
  { initials: "רי", name: "רון יצחק", stand: "רמת אביב", role: "מוכר", start: "11:30", hours: "2:45", rate: 40, status: "במשמרת", color: "blue" },
  { initials: "שא", name: "שירה אברהם", stand: "עזריאלי", role: "שוזרת", start: "—", hours: "0:00", rate: 47, status: "לא במשמרת", color: "pink" },
];

const nav = [
  ["⌂", "סקירה"], ["♙", "עובדים"], ["◷", "נוכחות ומשמרות"], ["₪", "שכר ודוחות"],
  ["✿", "עמדות ומלאי"], ["⌖", "מפת עמדות"], ["♚", "משתמשים והרשאות"], ["⚙", "הגדרות"],
];

const bouquets = [
  { name: "זר ורדים לבנים", price: 189, count: 16 }, { name: "זר שדה אביבי", price: 149, count: 9 },
  { name: "זר ורוד חגיגי", price: 219, count: 7 }, { name: "זר קטן לדרך", price: 89, count: 6 },
];

function money(value: number) { return new Intl.NumberFormat("he-IL").format(value) + " ₪"; }

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="data-table">
    <div className="data-head" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(110px, 1fr))` }}>{headers.map(h => <span key={h}>{h}</span>)}</div>
    {rows.map((row, index) => <div className="data-row" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(110px, 1fr))` }} key={index}>{row.map((cell, i) => <div key={i}>{cell}</div>)}</div>)}
  </div>;
}

export default function Home() {
  const [active, setActive] = useState("סקירה");
  const [period, setPeriod] = useState("היום");
  const [notice, setNotice] = useState("");
  const [standList, setStandList] = useState(initialStands);
  const [clocked, setClocked] = useState(true);
  const [modal, setModal] = useState("");
  const [role, setRole] = useState("מוכרת");
  const totalRevenue = useMemo(() => standList.reduce((sum, item) => sum + item.revenue, 0), [standList]);

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2400); }
  function restock(id: number) {
    setStandList(items => items.map(item => item.id === id ? { ...item, stock: item.stock + 10, status: "פתוחה" } : item));
    flash("המלאי עודכן בהצלחה");
  }
  function submitForm(event: FormEvent) { event.preventDefault(); setModal(""); flash("הפרטים נשמרו בהצלחה"); }

  const PageIntro = ({ title, text, action }: { title: string; text: string; action?: string }) =>
    <section className="page-intro"><div><h2>{title}</h2><p>{text}</p></div>{action && <button className="primary" onClick={() => setModal(action)}>{action}</button>}</section>;

  function Overview() {
    return <>
      <section className="hero-row"><div><h2>תמונת מצב של העסק</h2><p>כל מה שקורה ב־17 העמדות, במקום אחד.</p></div>
        <div className="period-tabs">{["היום", "השבוע", "החודש"].map(item => <button key={item} onClick={() => setPeriod(item)} className={period === item ? "selected" : ""}>{item}</button>)}</div>
      </section>
      <section className="stats">
        <article><div className="stat-icon green">♙</div><div><span>עובדים במשמרת</span><strong>12</strong><small><b>↑ 2</b> מהשעה האחרונה</small></div></article>
        <article><div className="stat-icon purple">₪</div><div><span>מכירות {period}</span><strong>{money(totalRevenue)}</strong><small><b>↑ 8.4%</b> לעומת אתמול</small></div></article>
        <article><div className="stat-icon pink">✿</div><div><span>זרים במלאי</span><strong>486</strong><small>בכל 17 העמדות</small></div></article>
        <article><div className="stat-icon amber">!</div><div><span>דורש טיפול</span><strong>3</strong><small className="warning">מלאי נמוך ב־3 עמדות</small></div></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel workers-panel">
          <div className="panel-head"><div><h3>עובדים במשמרת</h3><p>12 עובדים פעילים עכשיו</p></div><button onClick={() => setActive("עובדים")}>לכל העובדים ←</button></div>
          <div className="worker-list">{workers.slice(0, 4).map(worker => <div className="worker" key={worker.name}>
            <span className={`avatar ${worker.color}`}>{worker.initials}<i /></span><div className="worker-name"><b>{worker.name}</b><small>{worker.role} · {worker.stand}</small></div>
            <div><small>שעת כניסה</small><b>{worker.start}</b></div><div><small>סה״כ היום</small><b>{worker.hours}</b></div><button aria-label={`אפשרויות עבור ${worker.name}`}>⋮</button>
          </div>)}</div>
        </article>
        <article className="panel activity-panel">
          <div className="panel-head"><div><h3>פעילות אחרונה</h3><p>עדכונים בזמן אמת</p></div><button>הצגת הכול ←</button></div>
          <div className="timeline">
            <div><i className="sale">₪</i><p><b>מכירה חדשה בעזריאלי</b><span>זר ורדים לבנים · 189 ₪</span><small>לפני 4 דקות</small></p></div>
            <div><i className="stock">✿</i><p><b>נועה עדכנה מלאי</b><span>עמדת דיזנגוף · 12 זרים נוספו</span><small>לפני 18 דקות</small></p></div>
            <div><i className="clock">◷</i><p><b>דניאל התחיל משמרת</b><span>עמדת שרונה · אחמ״ש</span><small>לפני 32 דקות</small></p></div>
            <div><i className="alert">!</i><p><b>התראת מלאי נמוך</b><span>עמדת שרונה · נותרו 12 זרים</span><small>לפני 45 דקות</small></p></div>
          </div>
        </article>
      </section>
      <Stands compact />
    </>;
  }

  function Employees() {
    return <><PageIntro title="ניהול עובדים" text="פרטי העובדים, תפקידים, שכר ושיוך לעמדות." action="הוספת עובד" />
      <div className="toolbar"><label>חיפוש עובד<input placeholder="הקלדת שם העובד" /></label><label>סינון לפי תפקיד<select><option>כל התפקידים</option><option>מוכר או מוכרת</option><option>שוזר או שוזרת</option><option>אחמ״ש</option></select></label><button className="secondary">סינון</button></div>
      <section className="panel"><DataTable headers={["עובד", "תפקיד", "עמדה קבועה", "שכר לשעה", "מצב", "פעולות"]} rows={workers.map(w => [
        <b key="n">{w.name}</b>, w.role, w.stand, money(w.rate), <span className={w.status === "במשמרת" ? "pill good" : "pill"} key="s">{w.status}</span>,
        <button className="text-button" key="a" onClick={() => setModal("עריכת עובד")}>עריכה</button>
      ])} /></section>
    </>;
  }

  function Attendance() {
    return <><PageIntro title="נוכחות ומשמרות" text="מעקב אחר כניסות, יציאות ושעות העבודה של כל עובד." action="הוספת משמרת" />
      <section className="mini-stats"><article><span>נוכחים כעת</span><b>12 עובדים</b></article><article><span>שעות עבודה היום</span><b>74:35 שעות</b></article><article><span>חריגות לאישור</span><b>2 חריגות</b></article></section>
      <div className="toolbar"><label>תאריך<input type="date" defaultValue="2026-07-27" /></label><label>עמדה<select><option>כל העמדות</option><option>עזריאלי</option><option>שרונה</option></select></label><button className="secondary">הצגת נתונים</button></div>
      <section className="panel"><DataTable headers={["עובד", "עמדה", "תפקיד במשמרת", "כניסה", "יציאה", "סה״כ", "מצב"]} rows={workers.slice(0, 4).map(w => [
        <b key="n">{w.name}</b>, w.stand, w.role, w.start, "—", w.hours, <span className="pill good" key="s">משמרת פעילה</span>
      ])} /></section>
    </>;
  }

  function Payroll() {
    return <><PageIntro title="שכר ודוחות" text="חישוב שעות וסכום לתשלום לפי עובד ותקופה." action="הפקת דוח שכר" />
      <section className="mini-stats"><article><span>סה״כ לתשלום החודש</span><b>86,420 ₪</b></article><article><span>שעות שדווחו</span><b>1,764 שעות</b></article><article><span>עובדים בדוח</span><b>24 עובדים</b></article></section>
      <div className="toolbar"><label>תקופת שכר<select><option>יולי 2026</option><option>יוני 2026</option></select></label><button className="secondary">ייצוא לגיליון</button></div>
      <section className="panel"><DataTable headers={["עובד", "תפקיד", "שעות רגילות", "שעות נוספות", "שכר לשעה", "סכום לתשלום"]} rows={workers.map((w, i) => [
        <b key="n">{w.name}</b>, w.role, `${128 + i * 7}:00`, `${i + 2}:30`, money(w.rate), <b key="m">{money((128 + i * 7) * w.rate + (i + 2.5) * w.rate * 1.25)}</b>
      ])} /></section>
    </>;
  }

  function Stands({ compact = false }: { compact?: boolean }) {
    return <section className="panel stands-panel">
      <div className="panel-head"><div><h3>{compact ? "מצב העמדות" : "עמדות ומלאי"}</h3><p>כמויות, מחירים ומכירות בכל עמדה</p></div>
        {compact ? <button onClick={() => setActive("עמדות ומלאי")}>לכל 17 העמדות ←</button> : <button onClick={() => setModal("הוספת עמדה")}>הוספת עמדה</button>}</div>
      {!compact && <div className="bouquet-strip">{bouquets.map(b => <article key={b.name}><i>✿</i><div><b>{b.name}</b><small>{b.count} במלאי</small></div><strong>{money(b.price)}</strong><button onClick={() => setModal("עריכת פריט")}>עריכה</button></article>)}</div>}
      <div className="stand-table"><div className="table-head"><span>עמדה</span><span>מצב</span><span>מלאי זרים</span><span>מכירות היום</span><span>פעולות</span></div>
        {standList.map(stand => <div className="stand-row" key={stand.id}>
          <div className="stand-name"><i>✿</i><p><b>{stand.name}</b><small>⌖ {stand.address}</small></p></div>
          <span className={stand.status === "דורשת טיפול" ? "status attention" : "status"}>● {stand.status}</span>
          <div className="inventory"><b>{stand.stock} מתוך {stand.target}</b><span><i style={{ width: `${Math.min(100, stand.stock / stand.target * 100)}%` }} /></span></div>
          <b>{money(stand.revenue)}</b><div className="row-actions"><button onClick={() => restock(stand.id)}>הוספת מלאי</button><button onClick={() => setModal("עריכת עמדה")}>עריכה</button></div>
        </div>)}
      </div>
    </section>;
  }

  function MapScreen() {
    return <><PageIntro title="מפת עמדות" text="מיקום 17 העמדות, כתובות וניווט מהיר." action="נעיצת עמדה חדשה" />
      <section className="map-layout"><div className="map-canvas" aria-label="מפה סכמטית של עמדות">
        <div className="road one" /><div className="road two" /><div className="road three" />
        {standList.map((s, i) => <button className={`map-pin pin-${i + 1}`} key={s.id} onClick={() => flash(`${s.name} נבחרה`)}>✿<span>{s.name.replace("עמדת ", "")}</span></button>)}
      </div><aside className="map-list"><h3>עמדות באזור תל אביב</h3>{standList.map(s => <article key={s.id}><i>✿</i><div><b>{s.name}</b><small>{s.address}</small><span>{s.status}</span></div><button onClick={() => flash("הניווט נפתח")}>ניווט</button></article>)}</aside></section>
    </>;
  }

  function Permissions() {
    return <><PageIntro title="משתמשים והרשאות" text="שליטה בגישה למערכת לפי משתמש ותפקיד." action="הזמנת משתמש" />
      <section className="permission-grid">
        <article className="panel role-card"><i>♚</i><h3>מנהל ראשי</h3><p>גישה מלאה לכל העמדות, העובדים, השכר וההגדרות.</p><b>משתמש אחד</b></article>
        <article className="panel role-card"><i>♜</i><h3>מנהל עמדה</h3><p>ניהול עובדים ומלאי בעמדות שהוקצו למשתמש.</p><b>4 משתמשים</b></article>
        <article className="panel role-card"><i>♙</i><h3>עובד</h3><p>כניסה ויציאה, צפייה במשמרות ועדכון מלאי מורשה.</p><b>19 משתמשים</b></article>
      </section>
      <section className="panel"><DataTable headers={["משתמש", "תפקיד במערכת", "גישה לעמדות", "מצב", "פעולות"]} rows={[
        [<b key="1">לינוי רז</b>, "מנהל ראשי", "כל העמדות", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>],
        [<b key="2">דניאל ישראלי</b>, "מנהל עמדה", "שרונה ועזריאלי", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>],
        [<b key="3">נועה כהן</b>, "עובדת", "דיזנגוף", <span className="pill good" key="a">פעיל</span>, <button className="text-button" key="b">עריכה</button>],
      ]} /></section>
    </>;
  }

  function Settings() {
    return <><PageIntro title="הגדרות" text="פרטי העסק, כללי דיווח והעדפות המערכת." />
      <form className="settings-grid" onSubmit={submitForm}>
        <section className="panel form-card"><h3>פרטי העסק</h3><label>שם העסק<input defaultValue="לינוי עיצובים" /></label><label>מספר טלפון<input defaultValue="03-5551234" /></label><label>כתובת משרד<input defaultValue="תל אביב" /></label></section>
        <section className="panel form-card"><h3>הגדרות נוכחות</h3><label>מרחק מותר מהעמדה<select><option>עד 150 מטרים</option><option>עד 300 מטרים</option></select></label><label className="check"><input type="checkbox" defaultChecked /> דרישת מיקום בעת כניסה</label><label className="check"><input type="checkbox" defaultChecked /> שליחת התראה על חריגה</label></section>
        <section className="panel form-card"><h3>תפקידים ותעריפים</h3><label>תפקיד<select value={role} onChange={e => setRole(e.target.value)}><option>מוכרת</option><option>שוזרת</option><option>אחמ״ש</option></select></label><label>תעריף ברירת מחדל<input type="number" defaultValue="42" /></label><button type="button" className="secondary" onClick={() => flash("התפקיד נוסף לרשימה")}>הוספת תפקיד חדש</button></section>
        <div className="settings-actions"><button className="primary" type="submit">שמירת הגדרות</button><button className="secondary" type="button">ביטול שינויים</button></div>
      </form>
    </>;
  }

  const screens: Record<string, React.ReactNode> = {
    "סקירה": <Overview />, "עובדים": <Employees />, "נוכחות ומשמרות": <Attendance />, "שכר ודוחות": <Payroll />,
    "עמדות ומלאי": <><PageIntro title="עמדות ומלאי" text="ניהול כמויות הזרים והמחירים בכל אחת מ־17 העמדות." /><Stands /></>,
    "מפת עמדות": <MapScreen />, "משתמשים והרשאות": <Permissions />, "הגדרות": <Settings />,
  };

  return <main className="app-shell" dir="rtl">
    {notice && <div className="toast" role="status">✓ {notice}</div>}
    {modal && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={modal}><form className="modal" onSubmit={submitForm}><button type="button" className="modal-close" onClick={() => setModal("")} aria-label="סגירה">×</button><h2>{modal}</h2><p>מלאו את הפרטים ושמרו את השינויים.</p><label>שם<input required placeholder="הקלדת שם" /></label><label>שיוך לעמדה<select><option>עזריאלי</option><option>שרונה</option><option>דיזנגוף</option><option>רמת אביב</option></select></label><div><button type="button" className="secondary" onClick={() => setModal("")}>ביטול</button><button className="primary">שמירה</button></div></form></div>}
    <aside className="sidebar"><div className="brand"><div className="brand-mark">ל</div><div><strong>לינוי עיצובים</strong><span>מערכת ניהול</span></div></div>
      <nav aria-label="ניווט ראשי">{nav.map(([icon, label]) => <button key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)}><span>{icon}</span>{label}{label === "עמדות ומלאי" && <em>1</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><span>לר</span><div><b>לינוי רז</b><small>מנהלת ראשית</small></div><i>⋮</i></div></div>
    </aside>
    <section className="content"><header className="topbar"><div><p>יום שני, 27 ביולי</p><h1>{active === "סקירה" ? "בוקר טוב, לינוי" : active}</h1></div><div className="top-actions"><button className="icon-button" aria-label="התראות">♧<span /></button><button className="primary" onClick={() => setModal("הוספת עובד")}>הוספת עובד</button></div></header>
      <div className="mobile-clock"><div><span className={clocked ? "pulse" : ""} />{clocked ? "המשמרת שלך פעילה" : "אין משמרת פעילה"}</div><button onClick={() => { setClocked(!clocked); flash(clocked ? "היציאה נרשמה" : "הכניסה נרשמה"); }}>{clocked ? "יציאה" : "כניסה"}</button></div>
      <div className="screen">{screens[active]}</div>
    </section>
  </main>;
}

"use client";

import { useMemo, useState } from "react";

type Stand = {
  id: number;
  name: string;
  address: string;
  stock: number;
  target: number;
  revenue: number;
  status: "פתוחה" | "דורשת טיפול" | "סגורה";
};

const stands: Stand[] = [
  { id: 1, name: "עמדת עזריאלי", address: "דרך מנחם בגין 132, תל אביב", stock: 38, target: 45, revenue: 4260, status: "פתוחה" },
  { id: 2, name: "עמדת שרונה", address: "אלוף קלמן מגן 3, תל אביב", stock: 12, target: 40, revenue: 3180, status: "דורשת טיפול" },
  { id: 3, name: "עמדת דיזנגוף", address: "דיזנגוף 50, תל אביב", stock: 29, target: 35, revenue: 2840, status: "פתוחה" },
  { id: 4, name: "עמדת רמת אביב", address: "איינשטיין 40, תל אביב", stock: 33, target: 40, revenue: 2560, status: "פתוחה" },
];

const workers = [
  { initials: "מע", name: "מיה אדרי", stand: "עזריאלי", role: "מוכרת", start: "08:02", hours: "6:13", color: "lavender" },
  { initials: "די", name: "דניאל ישראלי", stand: "שרונה", role: "אחמ״ש", start: "09:15", hours: "5:00", color: "mint" },
  { initials: "נכ", name: "נועה כהן", stand: "דיזנגוף", role: "שוזרת", start: "10:01", hours: "4:14", color: "peach" },
  { initials: "רי", name: "רון יצחק", stand: "רמת אביב", role: "מוכר", start: "11:30", hours: "2:45", color: "blue" },
];

const nav = [
  ["⌂", "סקירה"],
  ["♙", "עובדים"],
  ["✿", "עמדות ומלאי"],
  ["₪", "שכר ודוחות"],
  ["⌖", "מפת עמדות"],
  ["⚙", "הגדרות"],
];

function money(value: number) {
  return new Intl.NumberFormat("he-IL").format(value) + " ₪";
}

export default function Home() {
  const [active, setActive] = useState("סקירה");
  const [period, setPeriod] = useState("היום");
  const [notice, setNotice] = useState("");
  const [standList, setStandList] = useState(stands);
  const [clocked, setClocked] = useState(true);
  const totalRevenue = useMemo(() => standList.reduce((sum, item) => sum + item.revenue, 0), [standList]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function restock(id: number) {
    setStandList((items) => items.map((item) => item.id === id ? { ...item, stock: item.stock + 10, status: "פתוחה" } : item));
    flash("המלאי עודכן בהצלחה");
  }

  return (
    <main className="app-shell" dir="rtl">
      {notice && <div className="toast" role="status">✓ {notice}</div>}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">ל</div>
          <div><strong>לינוי עיצובים</strong><span>מערכת ניהול</span></div>
        </div>
        <nav aria-label="ניווט ראשי">
          {nav.map(([icon, label]) => (
            <button key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)}>
              <span>{icon}</span>{label}
              {label === "עמדות ומלאי" && <em>1</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile"><span>לר</span><div><b>לינוי רז</b><small>מנהלת ראשית</small></div><i>⋮</i></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>יום שני, 27 ביולי</p>
            <h1>{active === "סקירה" ? "בוקר טוב, לינוי" : active}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="התראות">♧<span /></button>
            <button className="primary" onClick={() => flash("נפתח טופס להוספת עובד חדש")}>＋ הוספת עובד</button>
          </div>
        </header>

        <div className="mobile-clock">
          <div><span className={clocked ? "pulse" : ""} />{clocked ? "המשמרת שלך פעילה" : "אין משמרת פעילה"}</div>
          <button onClick={() => { setClocked(!clocked); flash(clocked ? "היציאה נרשמה" : "הכניסה נרשמה"); }}>{clocked ? "יציאה" : "כניסה"}</button>
        </div>

        <section className="hero-row">
          <div>
            <h2>תמונת מצב של העסק</h2>
            <p>כל מה שקורה ב־17 העמדות, במקום אחד.</p>
          </div>
          <div className="period-tabs">
            {["היום", "השבוע", "החודש"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={period === item ? "selected" : ""}>{item}</button>)}
          </div>
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
            <div className="worker-list">
              {workers.map((worker) => (
                <div className="worker" key={worker.name}>
                  <span className={`avatar ${worker.color}`}>{worker.initials}<i /></span>
                  <div className="worker-name"><b>{worker.name}</b><small>{worker.role} · {worker.stand}</small></div>
                  <div><small>שעת כניסה</small><b>{worker.start}</b></div>
                  <div><small>סה״כ היום</small><b>{worker.hours}</b></div>
                  <button aria-label={`אפשרויות עבור ${worker.name}`}>⋮</button>
                </div>
              ))}
            </div>
          </article>

          <article className="panel activity-panel">
            <div className="panel-head"><div><h3>פעילות אחרונה</h3><p>עדכונים בזמן אמת</p></div><button>הכול ←</button></div>
            <div className="timeline">
              <div><i className="sale">₪</i><p><b>מכירה חדשה בעזריאלי</b><span>זר ורדים לבנים · 189 ₪</span><small>לפני 4 דקות</small></p></div>
              <div><i className="stock">✿</i><p><b>נועה עדכנה מלאי</b><span>עמדת דיזנגוף · +12 זרים</span><small>לפני 18 דקות</small></p></div>
              <div><i className="clock">◷</i><p><b>דניאל התחיל משמרת</b><span>עמדת שרונה · אחמ״ש</span><small>לפני 32 דקות</small></p></div>
              <div><i className="alert">!</i><p><b>התראת מלאי נמוך</b><span>עמדת שרונה · נותרו 12 זרים</span><small>לפני 45 דקות</small></p></div>
            </div>
          </article>
        </section>

        <section className="panel stands-panel">
          <div className="panel-head"><div><h3>מצב העמדות</h3><p>מלאי ומכירות נכון לעכשיו</p></div><button onClick={() => setActive("עמדות ומלאי")}>לכל 17 העמדות ←</button></div>
          <div className="stand-table">
            <div className="table-head"><span>עמדה</span><span>סטטוס</span><span>מלאי זרים</span><span>מכירות היום</span><span>פעולות</span></div>
            {standList.map((stand) => (
              <div className="stand-row" key={stand.id}>
                <div className="stand-name"><i>✿</i><p><b>{stand.name}</b><small>⌖ {stand.address}</small></p></div>
                <span className={stand.status === "דורשת טיפול" ? "status attention" : "status"}>● {stand.status}</span>
                <div className="inventory"><b>{stand.stock} / {stand.target}</b><span><i style={{ width: `${Math.min(100, stand.stock / stand.target * 100)}%` }} /></span></div>
                <b>{money(stand.revenue)}</b>
                <div className="row-actions"><button onClick={() => restock(stand.id)}>＋ מלאי</button><button aria-label="אפשרויות">⋮</button></div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

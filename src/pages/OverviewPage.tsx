import { useState } from "react";
import { employees, stations } from "../data/mockData";
import { money } from "../utils/format";
import { useNavigate } from "react-router-dom";
import { StationTable } from "../components/StationTable";
import { useApp } from "../context/AppContext";

export function OverviewPage() {
  const [period, setPeriod] = useState("היום");
  const navigate = useNavigate();
  const { notify, openModal } = useApp();
  const revenue = stations.reduce((sum, station) => sum + station.revenue, 0);
  return <>
    <section className="hero-row"><div><h2>תמונת מצב של העסק</h2><p>כל מה שקורה ב־17 העמדות, במקום אחד.</p></div><div className="period-tabs">{["היום", "השבוע", "החודש"].map(item => <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></section>
    <section className="stats"><article><div className="stat-icon green">♙</div><div><span>עובדים במשמרת</span><strong>12</strong><small><b>↑ 2</b> מהשעה האחרונה</small></div></article><article><div className="stat-icon purple">₪</div><div><span>מכירות {period}</span><strong>{money(revenue)}</strong><small><b>↑ 8.4%</b> לעומת אתמול</small></div></article><article><div className="stat-icon pink">✿</div><div><span>זרים במלאי</span><strong>486</strong><small>בכל 17 העמדות</small></div></article><article><div className="stat-icon amber">!</div><div><span>דורש טיפול</span><strong>3</strong><small className="warning">מלאי נמוך ב־3 עמדות</small></div></article></section>
    <section className="dashboard-grid"><article className="panel workers-panel"><div className="panel-head"><div><h3>עובדים במשמרת</h3><p>12 עובדים פעילים עכשיו</p></div><button onClick={() => navigate("/employees")}>לכל העובדים ←</button></div>
      {employees.slice(0, 4).map(worker => <div className="worker" key={worker.id}><span className={`avatar ${worker.color}`}>{worker.initials}<i /></span><div className="worker-name"><b>{worker.name}</b><small>{worker.role} · {worker.station}</small></div><div><small>שעת כניסה</small><b>{worker.start}</b></div><div><small>סה״כ היום</small><b>{worker.hours}</b></div><button aria-label={`אפשרויות עבור ${worker.name}`}>⋮</button></div>)}</article>
      <article className="panel activity-panel"><div className="panel-head"><div><h3>פעילות אחרונה</h3><p>עדכונים בזמן אמת</p></div><button>הצגת הכול ←</button></div><div className="timeline"><div><i className="sale">₪</i><p><b>מכירה חדשה בעזריאלי</b><span>זר ורדים לבנים · 189 ₪</span><small>לפני 4 דקות</small></p></div><div><i className="stock">✿</i><p><b>נועה עדכנה מלאי</b><span>עמדת דיזנגוף · 12 זרים נוספו</span><small>לפני 18 דקות</small></p></div><div><i className="clock">◷</i><p><b>דניאל התחיל משמרת</b><span>עמדת שרונה · אחמ״ש</span><small>לפני 32 דקות</small></p></div></div></article></section>
    <section className="panel stands-panel"><div className="panel-head"><div><h3>מצב העמדות</h3><p>מלאי ומכירות נכון לעכשיו</p></div><button onClick={() => navigate("/stations")}>לכל 17 העמדות ←</button></div><StationTable stations={stations} onRestock={() => notify("המלאי עודכן בהצלחה")} onEdit={() => openModal("עריכת עמדה")} /></section>
  </>;
}

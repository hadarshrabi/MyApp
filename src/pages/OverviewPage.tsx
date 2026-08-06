import { useNavigate } from "react-router-dom";
import { StationTable } from "../components/StationTable";
import { useBusinessData } from "../context/BusinessDataContext";
import { useAttendanceExceptions } from "../context/AttendanceExceptionsContext";
import { money } from "../utils/format";

export function OverviewPage() {
  const navigate = useNavigate();
  const { employees, stations, loading, error } = useBusinessData();
  const { pendingCount } = useAttendanceExceptions();
  const activeStations = stations.filter(station => !station.archivedAt && station.active);
  const inactiveStations = stations.filter(station => !station.archivedAt && !station.active);
  const activeEmployees = employees.filter(item => item.status === "במשמרת");
  const revenue = activeStations.reduce((sum, station) => sum + station.revenue, 0);
  const inventory = activeStations.reduce((sum, station) => sum + station.stock, 0);
  if (loading) return <section className="panel dashboard-loading">טוען נתונים מעודכנים…</section>;
  if (error) return <section className="panel dashboard-loading">{error}</section>;
  return <div className="overview-page">
    <header className="overview-heading"><div><span>סקירה יומית</span><h2>תמונת מצב של העסק</h2><p>כל הנתונים החשובים במקום אחד, מעודכנים ישירות מהמערכת.</p></div><button onClick={() => navigate("/stations")}>ניהול עמדות <i>←</i></button></header>

    <button className={`overview-exception-alert ${pendingCount ? "warning" : "clear"}`} onClick={() => navigate("/exceptions")}>
      <span className="overview-alert-icon">!</span><div><small>חריגות נוכחות</small><strong>{pendingCount ? `${pendingCount} ממתינות לאישור` : "הכול תקין"}</strong><p>{pendingCount ? "נדרש לעבור על הדיווחים ולאשר או לדחות" : "אין כרגע דיווחים שדורשים טיפול"}</p></div><b>{pendingCount}</b><i>←</i>
    </button>

    <section className="overview-metrics" aria-label="נתונים מרכזיים">
      <article><span className="metric-icon green">♙</span><div><small>עובדים במשמרת</small><strong>{activeEmployees.length}</strong><p>{activeEmployees.length ? "פעילים עכשיו" : "אין עובדים במשמרת"}</p></div></article>
      <article><span className="metric-icon purple">₪</span><div><small>מכירות שנרשמו</small><strong>{money(revenue)}</strong><p>לפי דיווחי המכירה</p></div></article>
      <article><span className="metric-icon pink">✿</span><div><small>זרים במלאי</small><strong>{inventory}</strong><p>בכל העמדות הפעילות</p></div></article>
      <article><span className="metric-icon amber">⌖</span><div><small>עמדות פעילות</small><strong>{activeStations.length}</strong><p>{inactiveStations.length} עמדות לא פעילות</p></div></article>
    </section>

    <nav className="overview-shortcuts" aria-label="פעולות מהירות">
      <button onClick={() => navigate("/attendance")}><span>◷</span><b>נוכחות</b><small>צפייה במשמרות</small></button>
      <button onClick={() => navigate("/stations")}><span>✿</span><b>עמדות</b><small>מלאי ומיקומים</small></button>
      <button onClick={() => navigate("/map")}><span>⌖</span><b>מפה</b><small>כל העמדות</small></button>
    </nav>

    <section className="dashboard-grid"><article className="panel workers-panel"><div className="panel-head"><div><h3>עובדים במשמרת</h3><p>{activeEmployees.length} עובדים פעילים עכשיו</p></div><button onClick={() => navigate("/employees")}>לכל העובדים ←</button></div>
      {activeEmployees.length ? activeEmployees.slice(0, 4).map(worker => <div className="worker" key={worker.id}><span className={`avatar ${worker.color}`}>{worker.initials}<i /></span><div className="worker-name"><b>{worker.name}</b><small>{worker.role} · {worker.station}</small></div><div><small>שעת כניסה</small><b>{worker.start}</b></div></div>) : <div className="overview-empty"><span>♙</span><b>אין עובדים במשמרת כרגע</b><small>דיווח כניסה חדש יופיע כאן מיד.</small></div>}
    </article><article className="panel overview-station-status"><div className="panel-head"><div><h3>מצב העמדות</h3><p>תמונת מצב תפעולית</p></div><button onClick={() => navigate("/stations")}>ניהול ←</button></div><div><span><b>{activeStations.length}</b> פעילות</span><span><b>{inactiveStations.length}</b> לא פעילות</span><span><b>{activeStations.filter(item => item.status === "דורשת טיפול").length}</b> מלאי נמוך</span></div></article></section>
    <section className="panel stands-panel desktop-stations-overview"><div className="panel-head"><div><h3>מצב העמדות</h3><p>{activeStations.length} פעילות · {inactiveStations.length} לא פעילות</p></div><button onClick={() => navigate("/stations")}>לכל העמדות ←</button></div><StationTable stations={activeStations} /></section>
  </div>;
}

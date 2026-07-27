import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";

const navigation = [
  { icon: "⌂", label: "סקירה", path: "/" }, { icon: "♙", label: "עובדים", path: "/employees" },
  { icon: "◷", label: "נוכחות ומשמרות", path: "/attendance" }, { icon: "₪", label: "שכר ודוחות", path: "/payroll" },
  { icon: "✿", label: "עמדות ומלאי", path: "/stations" }, { icon: "⌖", label: "מפת עמדות", path: "/map" },
  { icon: "♚", label: "משתמשים והרשאות", path: "/users" }, { icon: "⚙", label: "הגדרות", path: "/settings" },
];

export function AppLayout() {
  const { user } = useAuth();
  const { openModal } = useApp();
  const location = useLocation();
  const current = navigation.find(item => item.path === location.pathname)?.label ?? "סקירה";
  return <main className="app-shell" dir="rtl">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">ל</div><div><strong>לינוי עיצובים</strong><span>מערכת ניהול</span></div></div>
      <nav aria-label="ניווט ראשי">{navigation.map(item => <NavLink key={item.path} to={item.path} end={item.path === "/"}><span>{item.icon}</span>{item.label}{item.path === "/stations" && <em>1</em>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><span>לר</span><div><b>{user.name}</b><small>מנהלת ראשית</small></div><i>⋮</i></div></div>
    </aside>
    <section className="content"><header className="topbar"><div><p>יום שני, 27 ביולי</p><h1>{current === "סקירה" ? "בוקר טוב, לינוי" : current}</h1></div><div className="top-actions"><button className="icon-button" aria-label="התראות">♧<span /></button><button className="primary" onClick={() => openModal("הוספת עובד")}>הוספת עובד</button></div></header>
      <div className="screen"><Outlet /></div>
    </section>
  </main>;
}

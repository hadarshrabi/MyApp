import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { SwipeSheet } from "../components/SwipeSheet";
import { useAuth } from "../context/AuthContext";
import { useAttendanceExceptions } from "../context/AttendanceExceptionsContext";

const adminNavigation = [
  { icon: "⌂", label: "סקירה", path: "/" },
  { icon: "♙", label: "עובדים", path: "/employees" },
  { icon: "◷", label: "נוכחות ומשמרות", mobileLabel: "נוכחות", path: "/attendance" },
  { icon: "₪", label: "שכר ודוחות", path: "/payroll" },
  { icon: "!", label: "חריגות נוכחות", mobileLabel: "חריגות", path: "/exceptions" },
  { icon: "✿", label: "עמדות ומלאי", path: "/stations" },
  { icon: "❀", label: "מוצרים", path: "/products" },
  { icon: "⌖", label: "מפת עמדות", path: "/map" },
  { icon: "♚", label: "משתמשים והרשאות", path: "/users" },
  { icon: "≡", label: "יומן פעילות", path: "/audit" },
  { icon: "⚙", label: "הגדרות", path: "/settings" },
];

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const { pendingCount } = useAttendanceExceptions();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    document.documentElement.classList.add("mobile-sheet-open");
    return () => document.documentElement.classList.remove("mobile-sheet-open");
  }, [moreOpen]);

  const handleMobileNavigation = (event: ReactMouseEvent<HTMLAnchorElement>, path: string) => {
    event.preventDefault();
    event.currentTarget.blur();
    setMoreOpen(false);

    const resetScroll = () => {
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    // Reset before changing route so a fixed bottom navigation tap cannot leave
    // Safari anchored to the previous page's bottom position.
    resetScroll();
    if (location.pathname !== path) navigate(path);
    window.requestAnimationFrame(resetScroll);
  };
  if (!user) return null;
  if (!isAdmin) return <main className="employee-app" dir="rtl">
    <button className="employee-logout" onClick={() => void logout()}>יציאה</button>
    <Outlet />
    <nav className="employee-nav" aria-label="ניווט עובד">
      <NavLink to="/" end onClick={event => handleMobileNavigation(event, "/")}><span>⌂</span>הבית שלי</NavLink>
      <NavLink to="/my-history" onClick={event => handleMobileNavigation(event, "/my-history")}><span>◷</span>משמרות ושכר</NavLink>
      <NavLink to="/map" onClick={event => handleMobileNavigation(event, "/map")}><span>⌖</span>מפת העמדה</NavLink>
    </nav>
  </main>;

  const current = adminNavigation.find(item => item.path === location.pathname)?.label ?? "סקירה";
  const primaryMobilePaths = new Set(["/", "/employees", "/attendance", "/exceptions"]);
  return <main className="app-shell" dir="rtl">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">ל</div><div><strong>לינוי עיצובים</strong><span>מערכת ניהול</span></div></div>
      <nav aria-label="ניווט ראשי">{adminNavigation.map(item =>
        <NavLink key={item.path} to={item.path} end={item.path === "/"}>
          <span>{item.icon}</span>{item.label}
          {item.path === "/exceptions" && pendingCount > 0 && <em className="danger-badge">{pendingCount}</em>}
        </NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><span>לר</span><div><b>{user.name}</b><small>מנהל מערכת</small></div><button onClick={() => void logout()} aria-label="יציאה מהמערכת">יציאה</button></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p>{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p><h1>{current === "סקירה" ? `שלום, ${user.name}` : current}</h1></div>
        <div className="top-actions"><button className={`icon-button ${pendingCount ? "has-alert" : ""}`} onClick={() => navigate("/exceptions")} aria-label={pendingCount ? `${pendingCount} חריגות נוכחות ממתינות` : "אין חריגות נוכחות ממתינות"}>♧{pendingCount > 0 && <span>{pendingCount}</span>}</button></div>
      </header>
      <div className="screen"><Outlet /></div>
    </section>
    <nav className="admin-mobile-nav" aria-label="ניווט ראשי לנייד">
      {adminNavigation.filter(item => primaryMobilePaths.has(item.path)).map(item =>
        <NavLink key={item.path} to={item.path} end={item.path === "/"} onClick={event => handleMobileNavigation(event, item.path)}>
          <span>{item.icon}</span><b>{item.mobileLabel ?? item.label}</b>
          {item.path === "/exceptions" && pendingCount > 0 && <em>{pendingCount}</em>}
        </NavLink>)}
      <button className={moreOpen ? "active" : ""} onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen}><span>•••</span><b>עוד</b></button>
    </nav>
    {moreOpen && <>
      <button className="mobile-drawer-scrim" aria-label="סגירת תפריט" onClick={() => setMoreOpen(false)} />
      <SwipeSheet className="mobile-more-sheet" ariaLabel="אפשרויות ניווט נוספות" onDismiss={() => setMoreOpen(false)}>
        <header><div><strong>עוד אפשרויות</strong><small>{user.name}</small></div></header>
        <div>{adminNavigation.filter(item => !primaryMobilePaths.has(item.path)).map(item =>
          <NavLink key={item.path} to={item.path} onClick={event => handleMobileNavigation(event, item.path)}><span>{item.icon}</span><b>{item.label}</b><i>‹</i></NavLink>)}</div>
        <button className="mobile-logout" onClick={() => void logout()}>יציאה מהמערכת</button>
      </SwipeSheet>
    </>}
  </main>;
}

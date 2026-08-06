import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageIntro } from "../components/PageIntro";
import { SwipeSheet } from "../components/SwipeSheet";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useBusinessData, type UserView } from "../context/BusinessDataContext";
import { userService, type ManagedUserInput } from "../services/userService";

type UserFilter = "ALL" | "ADMIN" | "EMPLOYEE" | "INACTIVE";
type UserForm = {
  displayName: string;
  email: string;
  password: string;
  systemRole: "ADMIN" | "EMPLOYEE";
  jobPosition: string;
  hourlyRate: string;
  assignedStationId: string;
};

const emptyForm: UserForm = {
  displayName: "",
  email: "",
  password: "",
  systemRole: "EMPLOYEE",
  jobPosition: "מוכר/ת",
  hourlyRate: "",
  assignedStationId: "",
};

export function UsersPage() {
  const { users, stations, refresh } = useBusinessData();
  const { user: signedInUser } = useAuth();
  const { notify } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("ALL");
  const [editingUser, setEditingUser] = useState<UserView | "NEW" | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [statusTarget, setStatusTarget] = useState<UserView | null>(null);

  const activeStations = stations
    .filter(station => station.active && !station.archivedAt)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const activeAdmins = users.filter(item => item.active && item.systemRole === "ADMIN").length;
  const activeEmployees = users.filter(item => item.active && item.systemRole === "EMPLOYEE").length;
  const inactiveUsers = users.filter(item => !item.active).length;
  const visibleUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("he");
    return users.filter(item => {
      const matchesText = !query || `${item.displayName} ${item.email} ${item.employee?.jobPosition ?? ""}`.toLocaleLowerCase("he").includes(query);
      const matchesFilter = filter === "ALL"
        || (filter === "INACTIVE" ? !item.active : item.systemRole === filter && item.active);
      return matchesText && matchesFilter;
    });
  }, [users, search, filter]);

  useEffect(() => {
    if (!editingUser && !statusTarget) return;
    document.documentElement.classList.add("mobile-sheet-open");
    return () => document.documentElement.classList.remove("mobile-sheet-open");
  }, [editingUser, statusTarget]);

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setConfirmRoleChange(false);
    setEditingUser("NEW");
  }

  function openEdit(target: UserView) {
    setForm({
      displayName: target.displayName,
      email: target.email,
      password: "",
      systemRole: target.systemRole,
      jobPosition: target.employee?.jobPosition ?? "מוכר/ת",
      hourlyRate: target.employee ? String(target.employee.hourlyRateCents / 100) : "",
      assignedStationId: target.employee?.assignedStationId ? String(target.employee.assignedStationId) : "",
    });
    setError("");
    setConfirmRoleChange(false);
    setEditingUser(target);
  }

  function closeEditor() {
    if (saving) return;
    setEditingUser(null);
    setConfirmRoleChange(false);
    setError("");
  }

  function validateForm() {
    if (form.displayName.trim().length < 2) return "יש להזין שם מלא";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "כתובת הדוא״ל אינה תקינה";
    if (editingUser === "NEW" && form.password.length < 10) return "הסיסמה חייבת להכיל לפחות 10 תווים";
    if (form.systemRole === "EMPLOYEE" && form.jobPosition.trim().length < 2) return "יש להזין תפקיד בעסק";
    const rate = form.hourlyRate === "" ? 0 : Number(form.hourlyRate);
    if (!Number.isFinite(rate) || rate < 0) return "השכר לשעה אינו תקין";
    return "";
  }

  function formPayload(): ManagedUserInput {
    return {
      displayName: form.displayName.trim(),
      email: form.email.trim().toLowerCase(),
      systemRole: form.systemRole,
      ...(form.systemRole === "EMPLOYEE" ? {
        jobPosition: form.jobPosition.trim(),
        hourlyRate: Number(form.hourlyRate || 0),
        assignedStationId: form.assignedStationId ? Number(form.assignedStationId) : null,
      } : {}),
    };
  }

  async function saveUser() {
    const validationMessage = validateForm();
    if (validationMessage) { setError(validationMessage); return; }
    if (editingUser && editingUser !== "NEW" && editingUser.systemRole !== form.systemRole && !confirmRoleChange) {
      setConfirmRoleChange(true);
      setError("");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingUser === "NEW") {
        await userService.create({ ...formPayload(), password: form.password });
        notify("המשתמש נוסף בהצלחה");
      } else if (editingUser) {
        await userService.update(editingUser.id, { ...formPayload(), reason: "עדכון משתמש והרשאות" });
        notify("פרטי המשתמש עודכנו");
      }
      await refresh();
      setEditingUser(null);
      setConfirmRoleChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן לשמור את המשתמש");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus() {
    if (!statusTarget) return;
    setSaving(true);
    setError("");
    try {
      await userService.setActive(statusTarget.id, !statusTarget.active);
      await refresh();
      notify(statusTarget.active ? "גישת המשתמש הושבתה" : "גישת המשתמש הוחזרה");
      setStatusTarget(null);
      setEditingUser(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן לשנות את מצב המשתמש");
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void saveUser();
  }

  return <div className="users-page">
    <PageIntro title="משתמשים והרשאות" text="ניהול מאובטח של מנהלים ועובדים. תפקיד בעסק נשמר בנפרד מהרשאת המערכת." />

    <section className="users-command-bar">
      <div><strong>{users.length} משתמשים</strong><small>{activeAdmins + activeEmployees} פעילים במערכת</small></div>
      <button className="primary users-add-button" type="button" onClick={openCreate}><span aria-hidden="true">＋</span> הוספת משתמש</button>
    </section>

    <section className="users-summary" aria-label="סיכום משתמשים">
      <button className={filter === "ADMIN" ? "selected" : ""} type="button" onClick={() => setFilter(filter === "ADMIN" ? "ALL" : "ADMIN")}><span className="user-summary-icon admin" aria-hidden="true">♚</span><div><small>מנהלים פעילים</small><strong>{activeAdmins}</strong></div></button>
      <button className={filter === "EMPLOYEE" ? "selected" : ""} type="button" onClick={() => setFilter(filter === "EMPLOYEE" ? "ALL" : "EMPLOYEE")}><span className="user-summary-icon employee" aria-hidden="true">♙</span><div><small>עובדים פעילים</small><strong>{activeEmployees}</strong></div></button>
      <button className={filter === "INACTIVE" ? "selected" : ""} type="button" onClick={() => setFilter(filter === "INACTIVE" ? "ALL" : "INACTIVE")}><span className="user-summary-icon inactive" aria-hidden="true">○</span><div><small>ללא גישה</small><strong>{inactiveUsers}</strong></div></button>
    </section>

    <section className="users-toolbar" aria-label="חיפוש וסינון משתמשים">
      <label className="users-search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="חיפוש לפי שם, דוא״ל או תפקיד" aria-label="חיפוש משתמש" />{search && <button type="button" onClick={() => setSearch("")} aria-label="ניקוי החיפוש">×</button>}</label>
      <div className="users-filter-chips" role="group" aria-label="סינון משתמשים">
        {([[
          "ALL", "הכל", users.length,
        ], ["ADMIN", "מנהלים", activeAdmins], ["EMPLOYEE", "עובדים", activeEmployees], ["INACTIVE", "לא פעילים", inactiveUsers]] as const).map(([value, label, count]) =>
          <button className={filter === value ? "active" : ""} type="button" key={value} onClick={() => setFilter(value)}>{label}<span>{count}</span></button>)}
      </div>
    </section>

    <section className="users-list" aria-live="polite">
      {visibleUsers.map(item => <article className={`managed-user-card${item.active ? "" : " inactive"}`} key={item.id}>
        <button className="managed-user-main" type="button" onClick={() => openEdit(item)} aria-label={`ניהול המשתמש ${item.displayName}`}>
          <span className={`managed-user-avatar ${item.systemRole === "ADMIN" ? "admin" : "employee"}`}>{initials(item.displayName)}</span>
          <span className="managed-user-identity"><strong>{item.displayName}{item.id === signedInUser?.id && <em>אני</em>}</strong><small dir="ltr">{item.email}</small></span>
          <span className="managed-user-badges"><b className={item.systemRole === "ADMIN" ? "admin" : "employee"}>{item.systemRole === "ADMIN" ? "מנהל" : "עובד"}</b><b className={item.active ? "active" : "inactive"}>{item.active ? "פעיל" : "ללא גישה"}</b></span>
          <i aria-hidden="true">‹</i>
        </button>
        <div className="managed-user-meta">
          <span><small>תפקיד בעסק</small><b>{item.systemRole === "ADMIN" ? "ניהול המערכת" : item.employee?.jobPosition ?? "לא הוגדר"}</b></span>
          <span><small>עמדה</small><b>{item.systemRole === "ADMIN" ? "כל העמדות" : item.employee?.assignedStation?.name ?? "ללא עמדה"}</b></span>
          <button type="button" onClick={() => openEdit(item)}>ניהול</button>
        </div>
      </article>)}
      {!visibleUsers.length && <article className="users-empty"><span>⌕</span><strong>לא נמצאו משתמשים</strong><small>אפשר לשנות את החיפוש או לבחור סינון אחר</small><button type="button" onClick={() => { setSearch(""); setFilter("ALL"); }}>ניקוי סינון</button></article>}
    </section>

    <details className="users-permission-help">
      <summary>מה ההבדל בין מנהל לעובד?</summary>
      <div><p><b>מנהל</b> יכול לנהל עובדים, נוכחות, שכר, עמדות, מלאי והרשאות.</p><p><b>עובד</b> יכול לדווח כניסה, יציאה ומכירה ולצפות רק בנתונים האישיים ובעמדה שלו.</p></div>
    </details>

    {editingUser && <>
      <button className="mobile-drawer-scrim user-sheet-scrim" aria-label="סגירת חלון ניהול משתמש" onClick={closeEditor} />
      <SwipeSheet className="user-editor-sheet" ariaLabel={editingUser === "NEW" ? "הוספת משתמש" : "עריכת משתמש"} onDismiss={closeEditor}>
        <header><div><strong>{editingUser === "NEW" ? "הוספת משתמש" : "ניהול משתמש"}</strong><small>{editingUser === "NEW" ? "יצירת גישה חדשה למערכת" : editingUser.displayName}</small></div>{editingUser !== "NEW" && <span className={editingUser.active ? "active" : "inactive"}>{editingUser.active ? "פעיל" : "ללא גישה"}</span>}</header>
        <form className="user-editor-form" onSubmit={submit}>
          {confirmRoleChange ? <div className="user-role-confirmation">
            <span aria-hidden="true">!</span>
            <strong>אישור שינוי הרשאה</strong>
            <p>התפקיד של <b>{editingUser !== "NEW" ? editingUser.displayName : "המשתמש"}</b> ישתנה מ־<b>{editingUser !== "NEW" && editingUser.systemRole === "ADMIN" ? "מנהל" : "עובד"}</b> ל־<b>{form.systemRole === "ADMIN" ? "מנהל" : "עובד"}</b>.</p>
            <small>{form.systemRole === "ADMIN" ? "לאחר השינוי תהיה למשתמש גישה מלאה לכל המערכת." : "לאחר השינוי המשתמש יקבל רק את מסכי העובד והעמדה שתיבחר."}</small>
          </div> : <div className="user-editor-fields">
            <div className="user-role-picker" role="group" aria-label="תפקיד מערכת">
              <button className={form.systemRole === "ADMIN" ? "selected" : ""} type="button" disabled={editingUser !== "NEW" && editingUser.id === signedInUser?.id} onClick={() => setForm(current => ({ ...current, systemRole: "ADMIN" }))}><span>♚</span><b>מנהל</b><small>גישה מלאה</small></button>
              <button className={form.systemRole === "EMPLOYEE" ? "selected" : ""} type="button" disabled={editingUser !== "NEW" && editingUser.id === signedInUser?.id} onClick={() => setForm(current => ({ ...current, systemRole: "EMPLOYEE" }))}><span>♙</span><b>עובד</b><small>גישה מוגבלת</small></button>
            </div>
            {editingUser !== "NEW" && editingUser.id === signedInUser?.id && <p className="user-self-note">לא ניתן לשנות את ההרשאה של המשתמש שמחובר כעת.</p>}
            <label>שם מלא<input autoComplete="name" value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} placeholder="שם המשתמש" /></label>
            <label>כתובת דוא״ל<input type="email" inputMode="email" autoComplete="email" dir="ltr" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="name@example.com" /></label>
            {editingUser === "NEW" && <label>סיסמה זמנית<input type="password" autoComplete="new-password" dir="ltr" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} placeholder="לפחות 10 תווים" /><small>הסיסמה מוצפנת בשרת ואינה נשמרת או מוצגת במסך.</small></label>}
            {form.systemRole === "EMPLOYEE" && <div className="employee-user-fields">
              <label>תפקיד בעסק<input value={form.jobPosition} onChange={event => setForm(current => ({ ...current, jobPosition: event.target.value }))} placeholder="לדוגמה: מוכר/ת" /></label>
              <label>שכר לשעה<input type="number" inputMode="decimal" min="0" step="0.01" value={form.hourlyRate} onChange={event => setForm(current => ({ ...current, hourlyRate: event.target.value }))} placeholder="0" /></label>
              <label className="wide">עמדה קבועה<select value={form.assignedStationId} onChange={event => setForm(current => ({ ...current, assignedStationId: event.target.value }))}><option value="">ללא עמדה בשלב זה</option>{activeStations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
            </div>}
            {editingUser !== "NEW" && editingUser.id !== signedInUser?.id && <button className={editingUser.active ? "user-status-action danger" : "user-status-action restore"} type="button" onClick={() => { setEditingUser(null); setStatusTarget(editingUser); setError(""); }}>{editingUser.active ? "השבתת גישה למערכת" : "החזרת גישה למערכת"}<small>{editingUser.active ? "המשתמש לא יוכל להתחבר, וההיסטוריה תישמר" : "המשתמש יוכל להתחבר שוב עם הסיסמה הקיימת"}</small></button>}
          </div>}
          {error && <p className="user-form-error" role="alert">{error}</p>}
          <footer>
            <button className="secondary" type="button" disabled={saving} onClick={() => confirmRoleChange ? setConfirmRoleChange(false) : closeEditor()}>{confirmRoleChange ? "חזרה" : "ביטול"}</button>
            <button className="primary" type="submit" disabled={saving}>{saving ? "שומר…" : confirmRoleChange ? "אישור ושינוי הרשאה" : editingUser === "NEW" ? "יצירת משתמש" : "שמירת שינויים"}</button>
          </footer>
        </form>
      </SwipeSheet>
    </>}

    {statusTarget && <>
      <button className="mobile-drawer-scrim user-sheet-scrim" aria-label="סגירת האישור" onClick={() => !saving && setStatusTarget(null)} />
      <SwipeSheet className="user-status-sheet" ariaLabel={statusTarget.active ? "אישור השבתת משתמש" : "אישור החזרת משתמש"} onDismiss={() => !saving && setStatusTarget(null)}>
        <div className={`user-status-symbol ${statusTarget.active ? "danger" : "restore"}`} aria-hidden="true">{statusTarget.active ? "!" : "↻"}</div>
        <h2>{statusTarget.active ? "להשבית את הגישה?" : "להחזיר את הגישה?"}</h2>
        <p><b>{statusTarget.displayName}</b> {statusTarget.active ? "לא יוכל להתחבר או להשתמש במערכת. כל רישומי הנוכחות, המכירות והביקורת יישמרו." : "יוכל להתחבר שוב למערכת באמצעות פרטי הכניסה הקיימים."}</p>
        {error && <p className="user-form-error" role="alert">{error}</p>}
        <footer><button className="secondary" type="button" disabled={saving} onClick={() => setStatusTarget(null)}>ביטול</button><button className={statusTarget.active ? "user-confirm-danger" : "primary"} type="button" disabled={saving} onClick={() => void changeStatus()}>{saving ? "מעדכן…" : statusTarget.active ? "כן, השבתת גישה" : "כן, החזרת גישה"}</button></footer>
      </SwipeSheet>
    </>}
  </div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map(part => part[0]).join("").slice(0, 2) || "?";
}

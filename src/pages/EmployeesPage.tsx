import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { SwipeSheet } from "../components/SwipeSheet";
import { useBusinessData } from "../context/BusinessDataContext";
import { useApp } from "../context/AppContext";
import { employeeService } from "../services/employeeService";
import type { Employee } from "../types/models";
import { money } from "../utils/format";

export function EmployeesPage() {
  const { employees, stations, refresh } = useBusinessData();
  const { notify } = useApp();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [assignmentEmployee, setAssignmentEmployee] = useState<Employee | null>(null);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [confirmingAssignment, setConfirmingAssignment] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const positions = [...new Set(employees.map(employee => employee.role))];
  const activeStations = stations.filter(station => station.active && !station.archivedAt).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const visible = useMemo(() => employees.filter(employee =>
    employee.name.includes(search.trim()) && (position === "ALL" || employee.role === position),
  ), [employees, search, position]);

  useEffect(() => {
    if (!filtersOpen && !assignmentEmployee) return;
    document.documentElement.classList.add("mobile-sheet-open");
    return () => document.documentElement.classList.remove("mobile-sheet-open");
  }, [filtersOpen, assignmentEmployee]);

  function openAssignment(employee: Employee) {
    setFiltersOpen(false);
    setAssignmentEmployee(employee);
    setSelectedStationId(employee.stationId ? String(employee.stationId) : "");
    setConfirmingAssignment(false);
  }

  function closeAssignment() {
    if (savingAssignment) return;
    setAssignmentEmployee(null);
    setSelectedStationId("");
    setConfirmingAssignment(false);
  }

  async function saveAssignment() {
    if (!assignmentEmployee) return;
    setSavingAssignment(true);
    try {
      await employeeService.assignStation(assignmentEmployee.id, selectedStationId ? Number(selectedStationId) : null);
      await refresh();
      notify(selectedStationId ? "העובד שויך לעמדה בהצלחה" : "שיוך העובד לעמדה הוסר");
      setAssignmentEmployee(null);
      setConfirmingAssignment(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "לא ניתן לעדכן את שיוך העובד");
    } finally {
      setSavingAssignment(false);
    }
  }

  const nextStationName = selectedStationId
    ? activeStations.find(station => station.id === Number(selectedStationId))?.name ?? "עמדה לא זמינה"
    : "ללא עמדה";
  const assignmentChanged = Boolean(assignmentEmployee) && Number(selectedStationId || 0) !== assignmentEmployee!.stationId;

  return <div className="employees-page">
    <PageIntro title="ניהול עובדים" text="פרטי העובדים, תפקידים, שכר ושיוך לעמדות." />

    <section className="employees-toolbar" aria-label="חיפוש וסינון עובדים">
      <label className="employees-search">
        <span aria-hidden="true">⌕</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="חיפוש לפי שם" aria-label="חיפוש עובד לפי שם" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="ניקוי החיפוש">×</button>}
      </label>
      <label className="employees-position-select">תפקיד
        <select value={position} onChange={event => setPosition(event.target.value)}><option value="ALL">כל התפקידים</option>{positions.map(item => <option value={item} key={item}>{item}</option>)}</select>
      </label>
      <button className={`employees-filter-button${position !== "ALL" ? " filtered" : ""}`} type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">≡</span><b>{position === "ALL" ? "סינון" : position}</b>{position !== "ALL" && <em>1</em>}
      </button>
      <span className="employees-result-count"><b>{visible.length}</b> {visible.length === 1 ? "עובד" : "עובדים"}</span>
    </section>

    <section className="panel employees-desktop-table"><DataTable headers={["עובד", "תפקיד", "עמדה קבועה", "שכר לשעה", "מצב", "שיוך"]} rows={visible.map(employee => [
      <b key="n">{employee.name}</b>, employee.role, employee.station, money(employee.hourlyRate),
      <span className={employee.status === "במשמרת" ? "pill good" : "pill"} key="s">{employee.status}</span>,
      <button className="text-button assign-station-button" type="button" key="a" disabled={employee.status === "במשמרת"} title={employee.status === "במשמרת" ? "ניתן לשנות עמדה לאחר סיום המשמרת" : "שינוי שיוך לעמדה"} onClick={() => openAssignment(employee)}>{employee.status === "במשמרת" ? "במשמרת" : "שינוי עמדה"}</button>,
    ])} /></section>

    <section className="employees-mobile-list" aria-live="polite">
      {visible.map(employee => {
        const expanded = expandedEmployeeId === employee.id;
        return <article className={`employee-list-card${expanded ? " expanded" : ""}`} key={employee.id}>
          <button className="employee-list-summary" type="button" aria-expanded={expanded} onClick={() => setExpandedEmployeeId(expanded ? null : employee.id)}>
            <span className={`employee-avatar ${employee.color}`}>{employee.initials}</span>
            <span className="employee-list-identity"><strong>{employee.name}</strong><small>{employee.role} · {employee.station}</small></span>
            <span className={employee.status === "במשמרת" ? "employee-state active" : "employee-state"}>{employee.status}</span>
            <i aria-hidden="true">⌄</i>
          </button>
          {expanded && <div className="employee-expanded-details">
            <dl>
              <div><dt>שכר לשעה</dt><dd>{money(employee.hourlyRate)}</dd></div>
              <div><dt>שעות שנרשמו</dt><dd>{employee.hours}</dd></div>
              <div><dt>עמדה קבועה</dt><dd>{employee.station}</dd></div>
              <div><dt>שעת כניסה</dt><dd>{employee.start}</dd></div>
            </dl>
            <p>המידע מחושב מרישומי הנוכחות. שינוי ידני מתבצע רק באמצעות פעולות מנהל מורשות.</p>
            <button className="employee-assignment-trigger" type="button" disabled={employee.status === "במשמרת"} onClick={() => openAssignment(employee)}>{employee.status === "במשמרת" ? "ניתן לשנות עמדה לאחר סיום המשמרת" : "שיוך לעמדה אחרת"}</button>
          </div>}
        </article>;
      })}
      {!visible.length && <article className="employees-empty"><span>⌕</span><strong>לא נמצאו עובדים</strong><small>אפשר לשנות את החיפוש או לנקות את הסינון</small><button type="button" onClick={() => { setSearch(""); setPosition("ALL"); }}>ניקוי סינון</button></article>}
    </section>

    {filtersOpen && <>
      <button className="mobile-drawer-scrim employees-filter-scrim" aria-label="סגירת הסינון" onClick={() => setFiltersOpen(false)} />
      <SwipeSheet className="employee-filter-sheet" ariaLabel="סינון עובדים לפי תפקיד" onDismiss={() => setFiltersOpen(false)}>
        <header><div><strong>סינון לפי תפקיד</strong><small>{visible.length} עובדים מוצגים</small></div></header>
        <div className="employee-role-options">
          <button className={position === "ALL" ? "selected" : ""} type="button" onClick={() => setPosition("ALL")}><span>כל התפקידים</span><b>{employees.length}</b></button>
          {positions.map(item => <button className={position === item ? "selected" : ""} type="button" key={item} onClick={() => setPosition(item)}><span>{item}</span><b>{employees.filter(employee => employee.role === item).length}</b></button>)}
        </div>
        <div className="employee-filter-actions"><button className="secondary" type="button" disabled={position === "ALL"} onClick={() => setPosition("ALL")}>איפוס</button><button className="primary" type="button" onClick={() => setFiltersOpen(false)}>הצגת {visible.length} עובדים</button></div>
      </SwipeSheet>
    </>}

    {assignmentEmployee && <>
      <button className="mobile-drawer-scrim employee-assignment-scrim" aria-label="סגירת חלון השיוך" onClick={closeAssignment} />
      <SwipeSheet className="employee-assignment-sheet" ariaLabel="שיוך עובד לעמדה" onDismiss={closeAssignment}>
        <header><div><strong>שיוך עובד לעמדה</strong><small>{assignmentEmployee.name} · {assignmentEmployee.role}</small></div></header>
        <div className="employee-assignment-body">
          {!confirmingAssignment ? <>
            <div className="current-assignment"><span>העמדה הנוכחית</span><b>{assignmentEmployee.station}</b></div>
            <label>בחירת עמדה חדשה
              <select value={selectedStationId} onChange={event => setSelectedStationId(event.target.value)}>
                <option value="">ללא עמדה</option>
                {assignmentEmployee.stationId > 0 && !activeStations.some(station => station.id === assignmentEmployee.stationId) && <option value={assignmentEmployee.stationId} disabled>{assignmentEmployee.station} · אינה פעילה</option>}
                {activeStations.map(station => <option value={station.id} key={station.id}>{station.name}{station.locationDescription ? ` · ${station.locationDescription}` : ""}</option>)}
              </select>
            </label>
            <p>העובד יוכל לדווח נוכחות ומכירות רק בעמדה שתיבחר. לא ניתן לשנות שיוך בזמן משמרת פעילה.</p>
          </> : <div className="assignment-confirmation">
            <span>נא לוודא לפני השמירה</span>
            <div><small>שיוך נוכחי</small><b>{assignmentEmployee.station}</b></div>
            <i aria-hidden="true">←</i>
            <div><small>שיוך חדש</small><b>{nextStationName}</b></div>
            <p>השינוי נשמר במסד הנתונים ונרשם בהיסטוריית הביקורת.</p>
          </div>}
        </div>
        <footer className="employee-assignment-actions">
          <button className="secondary" type="button" disabled={savingAssignment} onClick={() => confirmingAssignment ? setConfirmingAssignment(false) : closeAssignment()}>{confirmingAssignment ? "חזרה" : "ביטול"}</button>
          <button className="primary" type="button" disabled={savingAssignment || !assignmentChanged || (!activeStations.length && Boolean(selectedStationId))} onClick={() => confirmingAssignment ? void saveAssignment() : setConfirmingAssignment(true)}>{savingAssignment ? "שומר…" : confirmingAssignment ? "אישור ושמירת השיוך" : "המשך לאישור"}</button>
        </footer>
      </SwipeSheet>
    </>}
  </div>;
}

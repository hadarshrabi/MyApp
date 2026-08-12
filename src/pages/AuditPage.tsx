import { useMemo, useState } from "react";
import { PageIntro } from "../components/PageIntro";
import { useBusinessData } from "../context/BusinessDataContext";
import { activityMatches, mapAuditToActivity, type ActivityCategory } from "../presentation/activityLog";

const filters: Array<{ value: ActivityCategory | "ALL"; label: string }> = [
  { value: "ALL", label: "הכל" }, { value: "EMPLOYEES", label: "עובדים" }, { value: "USERS", label: "משתמשים" },
  { value: "ATTENDANCE", label: "נוכחות" }, { value: "STATIONS", label: "עמדות" }, { value: "INVENTORY", label: "מלאי" },
  { value: "PRODUCTS", label: "מוצרים" }, { value: "SYSTEM", label: "מערכת" },
];

export function AuditPage() {
  const { audits, users, stations, products, attendance } = useBusinessData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ActivityCategory | "ALL">("ALL");
  const activities = useMemo(() => audits
    .map(record => mapAuditToActivity(record, { users, stations, products, attendance }))
    .filter(item => activityMatches(item, query, category)), [audits, users, stations, products, attendance, query, category]);

  return <div className="activity-page">
    <PageIntro title="יומן פעילות" text="פעולות ושינויים שבוצעו במערכת" />
    <section className="activity-toolbar" aria-label="חיפוש וסינון ביומן הפעילות">
      <label className="activity-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש לפי שם או פעולה" aria-label="חיפוש ביומן הפעילות" /></label>
      <div className="activity-filters" role="group" aria-label="סינון לפי קטגוריה">{filters.map(filter => <button key={filter.value} className={category === filter.value ? "active" : ""} onClick={() => setCategory(filter.value)}>{filter.label}</button>)}</div>
    </section>
    <section className="activity-timeline" aria-live="polite">
      {activities.map(item => <article className="activity-card" key={item.id}>
        <div className="activity-avatar" aria-hidden="true">{item.initials}</div>
        <div className="activity-body">
          <header><div><strong>{item.actor}</strong><p>{item.description}{item.target && <> <b>„{item.target}”</b></>}</p></div><span className={`activity-category ${item.category.toLowerCase()}`}>{item.categoryLabel}</span></header>
          <time dateTime={audits.find(record => record.id === item.id)?.serverTimestamp}>{item.timestamp}</time>
          {item.changes.length > 0 && <details className="activity-changes"><summary>{item.changes.length === 1 ? "הצג שינוי" : `${item.changes.length} שדות עודכנו · הצג שינויים`}</summary><div>{item.changes.map(change => <dl key={change.label}><dt>{change.label}</dt><dd><span>{change.before}</span><i aria-hidden="true">←</i><strong>{change.after}</strong></dd></dl>)}</div></details>}
          {item.reason && <p className="activity-reason"><span aria-hidden="true">i</span>{item.reason}</p>}
          <details className="activity-technical"><summary>פרטים טכניים</summary><p><span>סוג רשומה: {item.technical.entityType}</span><span>פעולה: {item.technical.fieldName}</span></p></details>
        </div>
      </article>)}
      {!activities.length && <div className="activity-empty"><span aria-hidden="true">◷</span><strong>אין פעילות להצגה</strong><p>פעולות שבוצעו במערכת יופיעו כאן.</p></div>}
    </section>
  </div>;
}

import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { useBusinessData } from "../context/BusinessDataContext";

function display(value: unknown) {
  if (value === null || value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function AuditPage() {
  const { audits } = useBusinessData();
  return <><PageIntro title="היסטוריית ביקורת" text="תיעוד מלא ובלתי ניתן להסתרה של שינויים ידניים רגישים." />
    <section className="panel"><DataTable headers={["זמן", "מנהל", "סוג רשומה", "שדה", "ערך מקורי", "ערך חדש", "סיבה"]} rows={audits.map(item => [
      new Date(item.serverTimestamp).toLocaleString("he-IL"), item.adminUser.displayName, item.entityType, item.fieldName,
      display(item.originalValue), display(item.newValue), item.reason,
    ])} /></section>
  </>;
}

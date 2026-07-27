import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { bouquets } from "../data/mockData";
import { money } from "../utils/format";

export function ProductsPage() {
  return <><PageIntro title="מוצרים ומחירים" text="הגדרת סוגי הזרים ומחיר המכירה. הגישה למנהל בלבד." action="הוספת מוצר" /><section className="panel"><DataTable headers={["מוצר", "מחיר נוכחי", "מצב", "עודכן לאחרונה", "פעולות"]} rows={bouquets.map(item => [<b key="n">{item.name}</b>, money(item.price), <span className="pill good" key="s">פעיל</span>, "היום, 09:30", <button className="text-button" key="a">עריכת מחיר</button>])} /></section></>;
}

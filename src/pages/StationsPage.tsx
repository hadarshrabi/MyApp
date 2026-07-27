import { useState } from "react";
import { PageIntro } from "../components/PageIntro";
import { StationTable } from "../components/StationTable";
import { bouquets, stations as initialStations } from "../data/mockData";
import { useApp } from "../context/AppContext";
import { money } from "../utils/format";

export function StationsPage() {
  const [stations, setStations] = useState(initialStations);
  const { notify, openModal } = useApp();
  function restock(id: number) { setStations(items => items.map(item => item.id === id ? { ...item, stock: item.stock + 10, status: "פתוחה" as const } : item)); notify("המלאי עודכן בהצלחה"); }
  return <><PageIntro title="עמדות ומלאי" text="ניהול כמויות הזרים והמחירים בכל אחת מ־17 העמדות." action="הוספת עמדה" />
    <section className="panel stands-panel"><div className="panel-head"><div><h3>סוגי זרים ומחירים</h3><p>מחירון ומלאי בעמדה שנבחרה</p></div></div><div className="bouquet-strip">{bouquets.map(item => <article key={item.id}><i>✿</i><div><b>{item.name}</b><small>{item.count} במלאי</small></div><strong>{money(item.price)}</strong><button onClick={() => openModal("עריכת פריט")}>עריכה</button></article>)}</div>
      <StationTable stations={stations} onRestock={restock} onEdit={() => openModal("עריכת עמדה")} /></section>
  </>;
}

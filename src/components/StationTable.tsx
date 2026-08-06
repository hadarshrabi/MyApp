import type { Station } from "../types/models";
import { money } from "../utils/format";

export function StationTable({ stations }: { stations: Station[] }) {
  return <div className="stand-table no-actions"><div className="table-head"><span>עמדה</span><span>מצב</span><span>מלאי זרים</span><span>מכירות היום</span></div>
    {stations.map(station => <div className="stand-row" key={station.id}>
      <div className="stand-name"><i>✿</i><p><b>{station.name}</b><small>⌖ {station.address}</small></p></div>
      <span className={!station.active || station.status === "דורשת טיפול" ? "status attention" : "status"}>● {!station.active ? "לא פעילה" : station.status}</span>
      <div className="inventory"><b>{station.stock} מתוך {station.target}</b><span><i style={{ width: `${Math.min(100, station.stock / station.target * 100)}%` }} /></span></div>
      <b>{money(station.revenue)}</b>
    </div>)}
  </div>;
}

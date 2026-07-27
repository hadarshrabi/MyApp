import type { Station } from "../types/models";
import { money } from "../utils/format";

export function StationTable({ stations, onRestock, onEdit }: { stations: Station[]; onRestock: (id: number) => void; onEdit: () => void }) {
  return <div className="stand-table"><div className="table-head"><span>עמדה</span><span>מצב</span><span>מלאי זרים</span><span>מכירות היום</span><span>פעולות</span></div>
    {stations.map(station => <div className="stand-row" key={station.id}>
      <div className="stand-name"><i>✿</i><p><b>{station.name}</b><small>⌖ {station.address}</small></p></div>
      <span className={station.status === "דורשת טיפול" ? "status attention" : "status"}>● {station.status}</span>
      <div className="inventory"><b>{station.stock} מתוך {station.target}</b><span><i style={{ width: `${Math.min(100, station.stock / station.target * 100)}%` }} /></span></div>
      <b>{money(station.revenue)}</b><div className="row-actions"><button onClick={() => onRestock(station.id)}>הוספת מלאי</button><button onClick={onEdit}>עריכה</button></div>
    </div>)}
  </div>;
}

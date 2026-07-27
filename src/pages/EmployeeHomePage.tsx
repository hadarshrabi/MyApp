import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { stations } from "../data/mockData";
import { useAttendance } from "../hooks/useAttendance";
import { saleService } from "../services/saleService";

const inventory = [
  { id: "product-white-roses", name: "זר ורדים לבנים", quantity: 20, price: 189 },
  { id: "product-pink", name: "זר ורוד", quantity: 15, price: 149 },
  { id: "product-small", name: "זר קטן", quantity: 10, price: 89 },
];

export function EmployeeHomePage() {
  const { user } = useAuth();
  const { notify } = useApp();
  const { clock, loading } = useAttendance();
  const [clocked, setClocked] = useState(false);
  const [clockInTime, setClockInTime] = useState("—");
  const [locationStatus, setLocationStatus] = useState("ממתין לבדיקת מיקום");
  const [selling, setSelling] = useState(false);
  const [productId, setProductId] = useState(inventory[0].id);
  const [quantity, setQuantity] = useState(1);
  const station = stations.find(item => item.id === user.stationId) ?? stations[0];

  async function handleClock() {
    try {
      setLocationStatus("בודק את המרחק מהעמדה…");
      const action = clocked ? "CLOCK_OUT" : "CLOCK_IN";
      const record = await clock(station, action);
      if (!record.approved) { setLocationStatus(`דיווח חריג · ${record.distanceMeters} מטרים מהעמדה`); return notify("הדיווח נשמר כחריגה וממתין לאישור מנהל"); }
      setLocationStatus(`מיקום אומת · ${record.distanceMeters} מטרים מהעמדה`);
      setClocked(!clocked);
      if (!clocked) setClockInTime(new Date(record.timestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }));
      notify(clocked ? "היציאה נרשמה בזמן השרת" : "הכניסה נרשמה בזמן השרת");
    } catch (error) { setLocationStatus("המיקום לא אומת"); notify(error instanceof Error ? error.message : "לא ניתן לבצע דיווח"); }
  }

  async function submitSale() {
    try { await saleService.create(productId, quantity); setSelling(false); notify("המכירה נשמרה והמלאי עודכן"); }
    catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לשמור את המכירה"); }
  }

  return <div className="employee-home">
    <header className="employee-welcome"><div><span>שלום, {user.name}</span><h1>{station.name}</h1><p>{station.address}</p></div><i>✿</i></header>
    <section className={`employee-shift ${clocked ? "active" : ""}`}><div className="shift-status"><span className="pulse" /><div><small>מצב משמרת</small><b>{clocked ? "משמרת פעילה" : "אין משמרת פעילה"}</b></div><div><small>שעת כניסה</small><b>{clockInTime}</b></div></div>
      <button onClick={handleClock} disabled={loading}>{loading ? "בודק מיקום…" : clocked ? "יציאה" : "כניסה"}</button><p>⌖ {locationStatus}</p></section>
    <section className="employee-card"><div className="employee-card-head"><div><h2>מלאי זמין בעמדה</h2><p>הכמויות לקריאה בלבד ומתעדכנות לאחר מכירה</p></div><button className="primary" onClick={() => setSelling(true)}>דיווח מכירה</button></div>
      <div className="employee-inventory">{inventory.map(item => <article key={item.id}><i>✿</i><div><b>{item.name}</b><small>{item.price} ₪ ליחידה</small></div><strong>{item.quantity}<small> זרים</small></strong></article>)}</div></section>
    <section className="employee-card"><div className="employee-card-head"><div><h2>המשמרות האחרונות שלי</h2><p>מידע לקריאה בלבד</p></div></div>
      <div className="recent-shifts"><article><div><b>יום ראשון, 26 ביולי</b><small>עמדת עזריאלי</small></div><span>08:04–15:31</span><strong>7:27 שעות</strong></article><article><div><b>יום חמישי, 23 ביולי</b><small>עמדת עזריאלי</small></div><span>09:01–16:10</span><strong>7:09 שעות</strong></article></div></section>
    {selling && <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={() => setSelling(false)} aria-label="סגירה">×</button><h2>דיווח מכירה</h2><p>בחרו מוצר וכמות שנמכרה. המלאי יופחת אוטומטית.</p><label>סוג הזר<select value={productId} onChange={event => setProductId(event.target.value)}>{inventory.map(item => <option value={item.id} key={item.id}>{item.name} · {item.quantity} במלאי</option>)}</select></label><label>כמות שנמכרה<input type="number" min="1" max="20" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><div><button className="secondary" onClick={() => setSelling(false)}>ביטול</button><button className="primary" onClick={submitSale}>אישור מכירה</button></div></div></div>}
  </div>;
}

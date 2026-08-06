import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { useBusinessData } from "../context/BusinessDataContext";
import { useAttendance } from "../hooks/useAttendance";
import { saleService } from "../services/saleService";

export function EmployeeHomePage() {
  const { user } = useAuth();
  const { notify } = useApp();
  const { stations, employeeInventory: inventory, attendance, refresh } = useBusinessData();
  const { clock, loading } = useAttendance();
  const [locationStatus, setLocationStatus] = useState("ממתין לבדיקת מיקום");
  const [selling, setSelling] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [confirmingSale, setConfirmingSale] = useState(false);
  const [showAllAttendance, setShowAllAttendance] = useState(false);
  const station = stations[0];
  const latest = attendance[0];
  const clocked = latest?.action === "CLOCK_IN";
  useEffect(() => { if (!productId && inventory[0]) setProductId(inventory[0].id); }, [inventory, productId]);
  const clockInTime = clocked ? new Date(latest.serverTimestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—";
  const recent = useMemo(() => attendance.slice(0, showAllAttendance ? 8 : 3), [attendance, showAllAttendance]);
  const pendingException = attendance.find(record => record.exceptionStatus === "PENDING");

  async function handleClock() {
    if (!station) return notify("לא נמצאה עמדה משויכת");
    try {
      setLocationStatus("בודק את המרחק מהעמדה…");
      const record = await clock(station, clocked ? "CLOCK_OUT" : "CLOCK_IN");
      setLocationStatus(record.approved ? `המיקום אומת · ${record.distanceMeters} מ׳ מהעמדה` : "דיווח חריג · ממתין לאישור מנהל");
      notify(record.approved ? "הדיווח נשמר בזמן השרת" : "הדיווח נשמר כחריגה וממתין לאישור מנהל");
      await refresh();
    } catch (error) {
      setLocationStatus("המיקום לא אומת");
      notify(error instanceof Error ? error.message : "לא ניתן לבצע דיווח");
    }
  }

  async function submitSale() {
    try {
      await saleService.create(productId, quantity);
      setSelling(false); setConfirmingSale(false); setQuantity(1); await refresh();
      notify("המכירה נשמרה והמלאי עודכן");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לשמור את המכירה"); }
  }

  if (!user || !station) return <div className="employee-home"><section className="employee-card">טוען את נתוני העמדה…</section></div>;
  return <div className="employee-home">
    <header className="employee-welcome"><div><span>שלום, {user.name}</span><h1>{station.name}</h1><p>{station.address}</p></div><i>✿</i></header>
    <section className={`employee-shift ${clocked ? "active" : ""}`}><div className="shift-status"><span className="pulse" /><div><small>מצב משמרת</small><b>{clocked ? "משמרת פעילה" : "אין משמרת פעילה"}</b></div><div><small>שעת כניסה</small><b>{clockInTime}</b></div></div>
      <button onClick={handleClock} disabled={loading}>{loading ? "בודק מיקום…" : clocked ? "יציאה" : "כניסה"}</button><p>⌖ {locationStatus}</p></section>
    {pendingException && <details className="employee-exception-alert"><summary><span aria-hidden="true">!</span><div><strong>חריגת נוכחות ממתינה לאישור</strong><small>{pendingException.action === "CLOCK_IN" ? "כניסה" : "יציאה"} · {new Date(pendingException.serverTimestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</small></div><b>פרטים</b></summary><div className="employee-exception-details"><span>מרחק שנרשם <b>{Math.round(pendingException.distanceMeters)} מ׳</b></span><span>מרחק מותר <b>{station.allowedRadiusMeters} מ׳</b></span><small>הדיווח נשמר ואינו ניתן לעריכה.</small></div></details>}
    <section className="employee-card"><div className="employee-card-head"><div><h2>מלאי זמין בעמדה</h2><p>הכמויות לקריאה בלבד ומתעדכנות לאחר מכירה</p></div><button className="primary" onClick={() => setSelling(true)} disabled={!inventory.length}>דיווח מכירה</button></div>
      <div className="employee-inventory">{inventory.map(item => <article key={item.id}><i>✿</i><div><b>{item.name}</b><small>{item.price} ₪ ליחידה</small></div><strong>{item.count}<small> זרים</small></strong></article>)}</div></section>
    <section className="employee-card employee-attendance-card"><div className="employee-card-head"><div><h2>נוכחות אחרונה</h2><p>שלושת הדיווחים האחרונים</p></div></div>
      <div className="recent-shifts">{recent.map(record => <article key={record.id}><div><b>{record.action === "CLOCK_IN" ? "כניסה" : "יציאה"}</b><small>{record.station?.name ?? station.name}</small></div><span>{new Date(record.serverTimestamp).toLocaleDateString("he-IL")} · {new Date(record.serverTimestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span><i className={record.exceptionStatus === "PENDING" ? "pending" : ""}>{record.exceptionStatus === "PENDING" ? "ממתין" : "נקלט"}</i></article>)}</div>{attendance.length > 3 && <button className="employee-show-more" onClick={() => setShowAllAttendance(value => !value)}>{showAllAttendance ? "הצגת פחות" : `הצגת דיווחים נוספים (${Math.min(attendance.length - 3, 5)})`}</button>}</section>
    {selling && <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={() => { setSelling(false); setConfirmingSale(false); }} aria-label="סגירה">×</button><h2>{confirmingSale ? "אישור דיווח המכירה" : "דיווח מכירה"}</h2>{confirmingSale ? <div className="sale-confirmation"><p>האם הנתונים נכונים?</p><strong>{inventory.find(item => item.id === productId)?.name}</strong><dl><div><dt>כמות</dt><dd>{quantity}</dd></div><div><dt>סכום</dt><dd>{((inventory.find(item => item.id === productId)?.price ?? 0) * quantity).toFixed(2)} ₪</dd></div></dl><small>לאחר האישור המלאי יופחת ולא ניתן יהיה לשנות את הדיווח.</small></div> : <><p>בחרו מוצר וכמות שנמכרה. המלאי יופחת רק לאחר אישור נוסף.</p><label>סוג הזר<select value={productId} onChange={event => setProductId(event.target.value)}>{inventory.map(item => <option value={item.id} key={item.id}>{item.name} · {item.count} במלאי</option>)}</select></label><label>כמות שנמכרה<input type="number" min="1" max={inventory.find(item => item.id === productId)?.count ?? 1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label></>}<div><button className="secondary" onClick={() => confirmingSale ? setConfirmingSale(false) : setSelling(false)}>{confirmingSale ? "חזרה לתיקון" : "ביטול"}</button><button className="primary" disabled={!productId || quantity < 1 || quantity > (inventory.find(item => item.id === productId)?.count ?? 0)} onClick={() => confirmingSale ? void submitSale() : setConfirmingSale(true)}>{confirmingSale ? "כן, דיווח המכירה נכון" : "המשך לאישור"}</button></div></div></div>}
  </div>;
}

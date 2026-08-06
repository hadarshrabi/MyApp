import { useState } from "react";
import { PageIntro } from "../components/PageIntro";
import { useApp } from "../context/AppContext";
import { useBusinessData } from "../context/BusinessDataContext";
import { productService } from "../services/productService";
import { money } from "../utils/format";

type Product = ReturnType<typeof useBusinessData>["products"][number];

export function ProductsPage() {
  const { products, refresh } = useBusinessData();
  const { notify } = useApp();
  const [editing, setEditing] = useState<Product | "NEW" | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [reason, setReason] = useState("עדכון פרטי מוצר");
  const [saving, setSaving] = useState(false);

  function open(product: Product | "NEW") {
    setEditing(product); setName(product === "NEW" ? "" : product.name); setPrice(product === "NEW" ? 0 : product.price); setReason(product === "NEW" ? "יצירת מוצר חדש" : "עדכון פרטי מוצר");
  }
  async function save() {
    if (name.trim().length < 2 || price <= 0) return;
    setSaving(true);
    try {
      if (editing === "NEW") await productService.create(name.trim(), price);
      else if (editing) await productService.update(editing.id, { name: name.trim(), price }, reason);
      await refresh(); setEditing(null); notify(editing === "NEW" ? "המוצר נוצר ונוסף לקטלוג" : "המוצר עודכן");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לשמור את המוצר"); }
    finally { setSaving(false); }
  }
  async function toggle(product: Product) {
    setSaving(true);
    try {
      await productService.update(product.id, { active: !product.active }, product.active ? "השבתת מוצר בקטלוג" : "הפעלת מוצר בקטלוג");
      await refresh(); notify(product.active ? "המוצר הושבת ולא יוצע לשיוך חדש" : "המוצר הופעל");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לעדכן את מצב המוצר"); }
    finally { setSaving(false); }
  }

  return <><PageIntro title="מוצרים ומחירים" text="קטלוג סוגי הזרים, המחירים והשימוש בעמדות." />
    <div className="products-toolbar"><div><b>{products.length} מוצרים</b><span>{products.filter(item => item.active).length} פעילים</span></div><button className="primary" onClick={() => open("NEW")}>＋ מוצר חדש</button></div>
    <section className="product-admin-grid">{products.map(product => <article className={`panel product-admin-card ${product.active ? "" : "inactive"}`} key={product.id}>
      <header><div><h3>{product.name}</h3><span className={`review-status ${product.active ? "approved" : "rejected"}`}>{product.active ? "פעיל" : "לא פעיל"}</span></div><strong>{money(product.price)}</strong></header>
      <div className="product-usage"><span>מלאי כולל <b>{product.count}</b></span><span>בשימוש ב־<b>{product.stations.filter(item => item.active).length}</b> עמדות</span></div>
      <details><summary>שימוש בעמדות</summary>{product.stations.length ? product.stations.map(station => <p key={station.stationId}><span>{station.name}{!station.active && " · מושבת"}</span><b>{station.quantity}</b></p>) : <p>המוצר עדיין אינו משויך לעמדה.</p>}</details>
      <footer><button className="secondary" onClick={() => open(product)}>עריכת שם ומחיר</button><button className={product.active ? "reject-button" : "approve-button"} disabled={saving} onClick={() => void toggle(product)}>{product.active ? "השבתה" : "הפעלה"}</button></footer>
    </article>)}</section>
    {editing && <div className="modal-backdrop"><section className="modal product-editor"><button className="modal-close" onClick={() => setEditing(null)} aria-label="סגירה">×</button><h2>{editing === "NEW" ? "יצירת מוצר חדש" : "עריכת מוצר"}</h2><label>שם המוצר<input value={name} onChange={event => setName(event.target.value)} placeholder="לדוגמה: זר חג גדול" /></label><label>מחיר מכירה<input type="number" inputMode="decimal" min="0.01" step="0.01" value={price || ""} onChange={event => setPrice(Number(event.target.value))} /></label>{editing !== "NEW" && <label>סיבת השינוי<input value={reason} onChange={event => setReason(event.target.value)} /></label>}<div><button className="secondary" onClick={() => setEditing(null)}>ביטול</button><button className="primary" disabled={saving || name.trim().length < 2 || price <= 0 || reason.trim().length < 3} onClick={() => void save()}>{saving ? "שומר…" : "שמירה"}</button></div></section></div>}
  </>;
}

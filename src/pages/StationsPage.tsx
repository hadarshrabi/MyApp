import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageIntro } from "../components/PageIntro";
import { StationForm } from "../components/StationForm";
import { StationWizard } from "../components/StationWizard";
import { SwipeSheet } from "../components/SwipeSheet";
import { useBusinessData } from "../context/BusinessDataContext";
import { useApp } from "../context/AppContext";
import { stationService, type StationInput } from "../services/stationService";
import { productService } from "../services/productService";
import type { Station } from "../types/models";

type Filter = "ACTIVE" | "INACTIVE" | "ALL" | "ARCHIVED";
type SheetTab = "DETAILS" | "INVENTORY" | "ACTIONS";

export function StationsPage() {
  const { stations, products, refresh } = useBusinessData();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Station | "NEW" | null>(null);
  const [selected, setSelected] = useState<Station | null>(null);
  const [sheetTab, setSheetTab] = useState<SheetTab>("DETAILS");
  const [saving, setSaving] = useState(false);
  const [inventoryAction, setInventoryAction] = useState<null | { productId: string; name: string; mode: "ADD" | "REMOVE" | "COUNT"; current: number }>(null);
  const [inventoryAmount, setInventoryAmount] = useState(1);
  const [inventoryReason, setInventoryReason] = useState("");
  const [inventoryConfirming, setInventoryConfirming] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newProductQuantity, setNewProductQuantity] = useState(0);
  const [editingProduct, setEditingProduct] = useState<null | { id: string; name: string; price: number }>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState(0);
  const [productQuantity, setProductQuantity] = useState(0);
  const [stationRemoval, setStationRemoval] = useState<null | { station: Station; mode: "ARCHIVE" | "DELETE" }>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [swipedStationId, setSwipedStationId] = useState<number | null>(null);
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressSwipeClick = useRef<number | null>(null);
  const activeCount = stations.filter(item => !item.archivedAt && item.active).length;
  const inactiveCount = stations.filter(item => !item.archivedAt && !item.active).length;
  const archivedCount = stations.filter(item => item.archivedAt).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("he-IL");
    return stations.filter(item => {
      const matchesStatus = filter === "ARCHIVED"
        ? Boolean(item.archivedAt)
        : !item.archivedAt && (filter === "ALL" || item.active === (filter === "ACTIVE"));
      if (!matchesStatus) return false;
      if (!query) return true;
      return [item.name, item.locationDescription, item.address, item.internalNotes]
        .some(value => value?.toLocaleLowerCase("he-IL").includes(query));
    });
  }, [stations, filter, search]);
  useEffect(() => setSwipedStationId(null), [filter, search]);
  useEffect(() => {
    if (!editingProduct || !selected) return;
    setProductQuantity(selected.inventory?.find(item => item.id === editingProduct.id)?.quantity ?? 0);
  }, [editingProduct?.id, selected?.id]);

  function openStation(station: Station, tab: SheetTab = "DETAILS") {
    setSelected(station); setSheetTab(tab);
  }
  function beginStationSwipe(event: PointerEvent<HTMLButtonElement>, stationId: number) {
    swipeStart.current = { id: stationId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveStationSwipe(event: PointerEvent<HTMLButtonElement>, stationId: number) {
    const start = swipeStart.current;
    if (!start || start.id !== stationId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const revealWidth = stations.find(item => item.id === stationId)?.archivedAt ? 184 : 92;
    event.currentTarget.style.transform = `translateX(${Math.max(-revealWidth, Math.min(0, deltaX))}px)`;
  }
  function endStationSwipe(event: PointerEvent<HTMLButtonElement>, stationId: number) {
    const start = swipeStart.current;
    event.currentTarget.style.transform = "";
    swipeStart.current = null;
    if (!start || start.id !== stationId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX < -48 && Math.abs(deltaX) > Math.abs(deltaY)) { suppressSwipeClick.current = stationId; setSwipedStationId(stationId); }
    else if (deltaX > 24 || Math.abs(deltaX) <= Math.abs(deltaY)) setSwipedStationId(null);
  }
  function requestSwipeRemoval(station: Station) {
    setSwipedStationId(null);
    setDeleteConfirmation("");
    setStationRemoval({ station, mode: station.archivedAt ? "DELETE" : "ARCHIVE" });
  }
  async function save(value: StationInput, reason: string) {
    setSaving(true);
    try {
      if (editing === "NEW") await stationService.create(value);
      else if (editing) await stationService.update(editing.id, value, reason);
      await refresh(); setEditing(null); setSelected(null);
      notify(editing === "NEW" ? "העמדה נוצרה בהצלחה" : "העמדה עודכנה בהצלחה");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לשמור את העמדה"); }
    finally { setSaving(false); }
  }
  async function toggle(station: Station) {
    const reason = window.prompt(station.active ? "נא להזין סיבה להשבתת העמדה" : "נא להזין סיבה להפעלת העמדה מחדש");
    if (!reason || reason.trim().length < 3) return;
    try {
      await stationService.setActive(station.id, !station.active, reason); await refresh(); setSelected(null);
      notify(station.active ? "העמדה הושבתה וההיסטוריה נשמרה" : "העמדה הופעלה מחדש");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לעדכן את מצב העמדה"); }
  }
  async function duplicate(station: Station) {
    const name = window.prompt("שם העמדה החדשה", `${station.name} — עותק`);
    if (!name || name.trim().length < 2) return;
    try { await stationService.duplicate(station.id, name); await refresh(); setSelected(null); notify("הגדרת העמדה והמלאי שוכפלו"); }
    catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לשכפל את העמדה"); }
  }
  async function archiveStation() {
    if (!stationRemoval || stationRemoval.mode !== "ARCHIVE") return;
    setSaving(true);
    try {
      await stationService.archive(stationRemoval.station.id);
      await refresh(); setSelected(null); setStationRemoval(null); setFilter("ARCHIVED");
      notify("העמדה הועברה לארכיון וההיסטוריה נשמרה");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן להעביר את העמדה לארכיון"); }
    finally { setSaving(false); }
  }
  async function restoreStation(station: Station, activate = false) {
    setSaving(true);
    try {
      await stationService.restore(station.id, activate);
      await refresh(); setSelected(null); setSwipedStationId(null); setFilter(activate ? "ACTIVE" : "INACTIVE");
      notify(activate ? "העמדה שוחזרה מהארכיון וחזרה לפעילות" : "העמדה שוחזרה כעמדה לא פעילה");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לשחזר את העמדה"); }
    finally { setSaving(false); }
  }
  async function permanentlyDeleteStation() {
    if (!stationRemoval || stationRemoval.mode !== "DELETE") return;
    setSaving(true);
    try {
      await stationService.permanentlyDelete(stationRemoval.station.id, deleteConfirmation.trim());
      await refresh(); setSelected(null); setStationRemoval(null); setDeleteConfirmation("");
      notify("העמדה נמחקה לצמיתות");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן למחוק את העמדה לצמיתות"); }
    finally { setSaving(false); }
  }
  async function performInventoryAction() {
    if (!selected || !inventoryAction) return;
    const delta = inventoryAction.mode === "COUNT" || inventoryAction.mode === "ADD" ? inventoryAmount - inventoryAction.current : -inventoryAmount;
    const type = inventoryAction.mode === "ADD" ? (delta > 0 ? "STOCK_DELIVERY" : "MANUAL_ADJUSTMENT") : inventoryAction.mode === "REMOVE" ? "DAMAGED_REMOVAL" : "MANUAL_ADJUSTMENT";
    const reason = inventoryReason.trim().length >= 3 ? inventoryReason.trim() : `עדכון כמות מלאי מ־${inventoryAction.current} ל־${inventoryAmount}`;
    setSaving(true);
    try {
      await stationService.adjustInventory(selected.id, inventoryAction.productId, delta, type, reason);
      await refresh(); setSelected(null); setInventoryAction(null); setInventoryConfirming(false); setInventoryReason(""); setInventoryAmount(1); notify("המלאי עודכן ונרשם ביומן");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לעדכן את המלאי"); }
    finally { setSaving(false); }
  }
  async function addProduct() {
    if (!selected || !newProductId || !Number.isInteger(newProductQuantity) || newProductQuantity < 0) {
      notify("יש להזין כמות התחלתית תקינה שאינה שלילית");
      return;
    }
    setSaving(true);
    try {
      const previousQuantity = selected.inventory?.find(item => item.id === newProductId)?.quantity;
      await stationService.addProduct(selected.id, newProductId, previousQuantity === undefined ? newProductQuantity : previousQuantity + newProductQuantity);
      await refresh(); setSelected(null); setAddingProduct(false); setNewProductId(""); setNewProductQuantity(0); notify("סוג הזר נוסף לעמדה");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן להוסיף את המוצר לעמדה"); }
    finally { setSaving(false); }
  }
  function selectProductForStation(productId: string) {
    setNewProductId(productId);
    setNewProductQuantity(0);
  }
  function openAddProduct() {
    if (!selected) return;
    const firstProduct = products.find(product => product.active && !selected.inventory?.some(item => item.id === product.id && item.active));
    setAddingProduct(true);
    selectProductForStation(firstProduct?.id ?? "");
  }
  async function removeProduct(productId: string) {
    if (!selected) return;
    const stationBeforeClose = selected;
    setSelected(null);
    notify("משבית את המוצר בעמדה…");
    try { await stationService.removeProduct(stationBeforeClose.id, productId, "השבתת מוצר בעמדה על ידי מנהל"); await refresh(); notify("המוצר הושבת בעמדה ולא יוצע למכירה"); }
    catch (error) { setSelected(stationBeforeClose); setSheetTab("INVENTORY"); notify(error instanceof Error ? error.message : "לא ניתן להשבית את המוצר"); }
  }
  async function activateProduct(productId: string, quantity: number) {
    if (!selected) return;
    const stationBeforeClose = selected;
    setSelected(null);
    notify("מפעיל את המוצר מחדש…");
    try { await stationService.addProduct(stationBeforeClose.id, productId, quantity); await refresh(); notify("המוצר הופעל מחדש בעמדה"); }
    catch (error) { setSelected(stationBeforeClose); setSheetTab("INVENTORY"); notify(error instanceof Error ? error.message : "לא ניתן להפעיל את המוצר"); }
  }
  async function saveProduct() {
    if (!selected || !editingProduct || productName.trim().length < 2 || !Number.isFinite(productPrice) || productPrice <= 0 || !Number.isInteger(productQuantity) || productQuantity < 0) return;
    setSaving(true);
    try {
      await stationService.updateProductDetails(selected.id, editingProduct.id, { name: productName.trim(), price: productPrice, quantity: productQuantity });
      await refresh(); setEditingProduct(null); setSelected(null); notify("פרטי המוצר עודכנו");
    } catch (error) { notify(error instanceof Error ? error.message : "שמירת פרטי המוצר נכשלה"); }
    finally { setSaving(false); }
  }

  return <div className="stations-page">
    <PageIntro title="עמדות ומלאי" text="ניהול עמדות, מיקומים ומלאי." />
    <section className="station-mobile-sticky">
      <div className="station-mobile-heading"><div><h2>עמדות</h2><p><b>{activeCount}</b> פעילות · {inactiveCount} לא פעילות · {archivedCount} בארכיון</p></div><button className="primary" onClick={() => setEditing("NEW")}>＋ עמדה</button></div>
      <StationSearch value={search} onChange={setSearch} resultCount={visible.length} />
      <StationFilters filter={filter} setFilter={setFilter} active={activeCount} inactive={inactiveCount} archived={archivedCount} total={activeCount + inactiveCount} />
    </section>
    <section className="station-summary">
      <article><span>עמדות פעילות</span><strong>{activeCount}</strong></article>
      <article><span>עמדות לא פעילות</span><strong>{inactiveCount}</strong></article>
      <article><span>עמדות בארכיון</span><strong>{archivedCount}</strong></article>
      <button className="primary" onClick={() => setEditing("NEW")}>הוספת עמדה</button>
    </section>
    <div className="station-desktop-filters"><StationSearch value={search} onChange={setSearch} resultCount={visible.length} /><StationFilters filter={filter} setFilter={setFilter} active={activeCount} inactive={inactiveCount} archived={archivedCount} total={activeCount + inactiveCount} /></div>

    <section className="station-compact-list">
      {visible.map(station => <div className="station-swipe-row" key={station.id}>
        <div className={`station-swipe-actions ${station.archivedAt ? "archived-actions" : ""}`}>
          {station.archivedAt && <button className="station-swipe-action restore" disabled={saving} onClick={() => void restoreStation(station, true)} aria-label={`שחזור ${station.name} לפעילות`}>שחזור<br />לפעילות</button>}
          <button className={`station-swipe-action ${station.archivedAt ? "permanent" : ""}`} onClick={() => requestSwipeRemoval(station)} aria-label={station.archivedAt ? `מחיקה לצמיתות של ${station.name}` : `העברת ${station.name} לארכיון`}>{station.archivedAt ? "מחיקה" : "ארכיון"}</button>
        </div>
        <button style={swipedStationId === station.id ? { transform: `translateX(-${station.archivedAt ? 184 : 92}px)` } : undefined} className={`station-compact-row ${station.active ? "" : "inactive"} ${station.archivedAt ? "archived archived-options" : ""} ${swipedStationId === station.id ? "swiped" : ""}`} onPointerDown={event => beginStationSwipe(event, station.id)} onPointerMove={event => moveStationSwipe(event, station.id)} onPointerUp={event => endStationSwipe(event, station.id)} onPointerCancel={event => { event.currentTarget.style.transform = ""; swipeStart.current = null; }} onClick={() => { if (suppressSwipeClick.current === station.id) { suppressSwipeClick.current = null; return; } swipedStationId === station.id ? setSwipedStationId(null) : openStation(station); }}>
          <span className="station-row-main"><span className="station-row-title"><b>{station.name}</b><i className={`review-status ${station.archivedAt ? "archived" : station.active ? "approved" : "rejected"}`}>{station.archivedAt ? "בארכיון" : station.active ? "פעילה" : "לא פעילה"}</i></span><small>{station.locationDescription || station.address || "מיקום לפי נקודה במפה"}</small></span>
          <span className="station-row-stock"><b>{station.stock}</b><small>זרים במלאי{station.inventory?.length ? ` · ${station.inventory.length} סוגים` : ""}</small></span>
          {station.status === "דורשת טיפול" && <span className="station-warning" aria-label="נדרש טיפול">!</span>}
          <span className="station-row-chevron" aria-hidden="true">‹</span>
        </button>
      </div>)}
      {!visible.length && <p className="station-compact-empty">{search.trim() ? "לא נמצאו עמדות שתואמות לחיפוש." : "אין עמדות התואמות לסינון."}</p>}
    </section>

    <section className="station-cards station-desktop-cards">
      {visible.map(station => <article className={`panel station-admin-card ${station.active ? "" : "inactive"} ${station.archivedAt ? "archived" : ""}`} key={station.id}>
        <div><span className={`review-status ${station.archivedAt ? "archived" : station.active ? "approved" : "rejected"}`}>{station.archivedAt ? "בארכיון" : station.active ? "פעילה" : "לא פעילה"}</span><h3>{station.name}</h3><p>{station.locationDescription || station.address || "ללא תיאור כתובת — המיקום נקבע לפי הקואורדינטות"}</p></div>
        <dl><div><dt>קו רוחב</dt><dd>{station.latitude.toFixed(6)}</dd></div><div><dt>קו אורך</dt><dd>{station.longitude.toFixed(6)}</dd></div><div><dt>רדיוס נוכחות</dt><dd>{station.allowedRadiusMeters} מטר</dd></div><div><dt>מלאי</dt><dd>{station.stock} זרים</dd></div></dl>
        {(station.startDate || station.endDate) && <p className="station-period">תקופת פעילות: {formatDate(station.startDate)} – {formatDate(station.endDate)}</p>}
        <div className="station-card-actions">{station.archivedAt ? <><button className="approve-button" onClick={() => void restoreStation(station)}>שחזור מהארכיון</button><button className="reject-button" onClick={() => { setDeleteConfirmation(""); setStationRemoval({ station, mode: "DELETE" }); }}>מחיקה לצמיתות</button></> : <><button className="secondary" onClick={() => setEditing(station)}>עריכה ומיקום</button><button className="secondary" onClick={() => void duplicate(station)}>שכפול הגדרה</button><button className={station.active ? "reject-button" : "approve-button"} onClick={() => void toggle(station)}>{station.active ? "השבתה" : "הפעלה מחדש"}</button><button className="archive-button" onClick={() => setStationRemoval({ station, mode: "ARCHIVE" })}>העברה לארכיון</button></>}</div>
      </article>)}
    </section>

    {selected && <div className="modal-backdrop station-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <SwipeSheet className="station-detail-sheet" ariaLabel={`פרטי ${selected.name}`} onDismiss={() => setSelected(null)}>
        <header><div><h2>{selected.name}</h2><span className={`review-status ${selected.archivedAt ? "archived" : selected.active ? "approved" : "rejected"}`}>{selected.archivedAt ? "בארכיון" : selected.active ? "פעילה" : "לא פעילה"}</span></div></header>
        <nav className="station-sheet-tabs" aria-label="חלקי פרטי עמדה">
          <button className={sheetTab === "DETAILS" ? "active" : ""} onClick={() => setSheetTab("DETAILS")}>פרטים</button>
          <button className={sheetTab === "INVENTORY" ? "active" : ""} onClick={() => setSheetTab("INVENTORY")}>מלאי</button>
          <button className={sheetTab === "ACTIONS" ? "active" : ""} onClick={() => setSheetTab("ACTIONS")}>פעולות</button>
        </nav>
        <div className="station-sheet-body">
          {sheetTab === "DETAILS" && <><p className="station-sheet-location">{selected.locationDescription || selected.address || "מיקום לפי נקודה במפה"}</p>{selected.archivedAt && <div className="archive-notice"><b>נמצאת בארכיון</b><br />הועברה בתאריך {new Date(selected.archivedAt).toLocaleDateString("he-IL")}{selected.archiveReason ? ` · ${selected.archiveReason}` : ""}</div>}<dl className="station-technical-details">
            <div><dt>רדיוס נוכחות</dt><dd>{selected.allowedRadiusMeters} מ׳</dd></div><div><dt>קו רוחב</dt><dd dir="ltr">{selected.latitude.toFixed(6)}</dd></div><div><dt>קו אורך</dt><dd dir="ltr">{selected.longitude.toFixed(6)}</dd></div><div><dt>תקופת פעילות</dt><dd>{formatDate(selected.startDate)} – {formatDate(selected.endDate)}</dd></div>
          </dl>{selected.internalNotes && <div className="station-sheet-notes"><b>הערות פנימיות</b><p>{selected.internalNotes}</p></div>}</>}
          {sheetTab === "INVENTORY" && <><div className="station-inventory-total"><span>{selected.archivedAt ? "מלאי היסטורי" : "מלאי זמין למכירה"}</span><strong>{selected.stock} זרים</strong></div>{!selected.archivedAt && <button className="secondary add-station-product" onClick={openAddProduct}>＋ הוספת סוג זר לעמדה</button>}<div className="station-inventory-list admin-inventory-list">{selected.inventory?.map(item => <article className={item.active ? "" : "inactive"} key={item.id}><div className="inventory-row-head"><div><b>{item.name}</b><small>מחיר מכירה: {item.price} ₪ {!item.active && "· מושבת בעמדה"}</small></div><strong>{item.quantity}<small> יח׳</small></strong></div>{!selected.archivedAt && <><button className="edit-product-inline" onClick={() => { setEditingProduct({ id: item.id, name: item.name, price: item.price }); setProductName(item.name); setProductPrice(item.price); }}>עריכת שם ומחיר</button>{item.active ? <div className="inventory-row-actions"><button className="inventory-update-button" onClick={() => { setInventoryAction({ productId: item.id, name: item.name, mode: "ADD", current: item.quantity }); setInventoryAmount(item.quantity); setInventoryConfirming(false); }}>עדכון כמות</button><button className="remove-product" onClick={() => void removeProduct(item.id)}>השבתה בעמדה</button></div> : <button className="secondary reactivate-product" onClick={() => void activateProduct(item.id, item.quantity)}>הפעלה מחדש בעמדה</button>}</>}</article>)}{!selected.inventory?.length && <p>אין פריטי מלאי בעמדה.</p>}</div></>}
          {sheetTab === "ACTIONS" && <div className="station-sheet-actions">{selected.archivedAt ? <>
            <button onClick={() => void restoreStation(selected)}><span>↶</span><div><b>שחזור מהארכיון</b><small>העמדה תחזור לרשימת הלא פעילות</small></div><i>‹</i></button>
            <button className="danger" onClick={() => { setDeleteConfirmation(""); setStationRemoval({ station: selected, mode: "DELETE" }); }}><span>⌫</span><div><b>מחיקה לצמיתות</b><small>מחיקת העמדה וכל נתוני העבר שלה</small></div><i>‹</i></button>
          </> : <>
            <button onClick={() => { setEditing(selected); setSelected(null); }}><span>✎</span><div><b>עריכת עמדה</b><small>פרטים, מיקום ורדיוס</small></div><i>‹</i></button>
            <button onClick={() => navigate("/map")}><span>⌖</span><div><b>הצגה במפה</b><small>פתיחת מפת העמדות</small></div><i>‹</i></button>
            <button onClick={() => setSheetTab("INVENTORY")}><span>✿</span><div><b>ניהול מלאי</b><small>צפייה בהרכב המלאי</small></div><i>‹</i></button>
            <button onClick={() => void duplicate(selected)}><span>⧉</span><div><b>שכפול עמדה</b><small>העתקת ההגדרות והמלאי</small></div><i>‹</i></button>
            <button className="danger" onClick={() => void toggle(selected)}><span>○</span><div><b>{selected.active ? "השבתת עמדה" : "הפעלת עמדה"}</b><small>הפעולה תישמר ביומן הביקורת</small></div><i>‹</i></button>
            <button className="danger archive-action" onClick={() => setStationRemoval({ station: selected, mode: "ARCHIVE" })}><span>⌫</span><div><b>הסרת עמדה</b><small>העברה לארכיון ללא מחיקת היסטוריה</small></div><i>‹</i></button>
          </>}</div>}
        </div>
      </SwipeSheet>
    </div>}
    {stationRemoval && <div className="modal-backdrop"><SwipeSheet className="modal station-removal-sheet" onDismiss={() => { setStationRemoval(null); setDeleteConfirmation(""); }}>
      {stationRemoval.mode === "ARCHIVE" ? <><h2>העברת עמדה לארכיון</h2><p><b>{stationRemoval.station.name}</b> תוסר מהרשימות הפעילות ומהמפה. כל היסטוריית הנוכחות, המכירות והמלאי תישמר וניתן יהיה לשחזר אותה.</p><div className="archive-notice">עובדים המשויכים לעמדה ינותקו ממנה ולא יוכלו לדווח בה.</div><div><button className="secondary" onClick={() => setStationRemoval(null)}>ביטול</button><button className="reject-button" disabled={saving} onClick={() => void archiveStation()}>{saving ? "מעביר…" : "העברה לארכיון"}</button></div></> : <><h2>מחיקה לצמיתות</h2><p>פעולה זו אינה ניתנת לביטול. העמדה וכל נתוני הנוכחות, המכירות, המלאי ותנועות המלאי השייכים לה יימחקו לצמיתות.</p><div className="permanent-delete-warning"><b>חשוב:</b> הנתונים לא יופיעו יותר בדוחות ולא ניתן יהיה לשחזר אותם.</div><label>להמשך יש להקליד את שם העמדה בדיוק<input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder={stationRemoval.station.name} autoComplete="off" /></label><div><button className="secondary" onClick={() => { setStationRemoval(null); setDeleteConfirmation(""); }}>ביטול</button><button className="reject-button" disabled={saving || deleteConfirmation.trim() !== stationRemoval.station.name} onClick={() => void permanentlyDeleteStation()}>{saving ? "מוחק…" : "מחיקת העמדה וכל ההיסטוריה"}</button></div></>}
    </SwipeSheet></div>}
    {inventoryAction && <div className="modal-backdrop"><SwipeSheet className="modal inventory-action-sheet" onDismiss={() => { setInventoryAction(null); setInventoryConfirming(false); }}>{inventoryConfirming ? <><h2>אימות עדכון מלאי</h2><div className="inventory-confirmation"><p>נא לוודא שהכמות החדשה נכונה לפני השמירה.</p><strong>{inventoryAction.name}</strong><dl><div><dt>כמות קודמת</dt><dd>{inventoryAction.current}</dd></div><div><dt>כמות חדשה</dt><dd>{inventoryAmount}</dd></div></dl><small>{inventoryAmount > inventoryAction.current ? `יתווספו ${inventoryAmount - inventoryAction.current} זרים` : inventoryAmount < inventoryAction.current ? `יופחתו ${inventoryAction.current - inventoryAmount} זרים` : "לא חל שינוי בכמות"}</small></div><div><button className="secondary" onClick={() => setInventoryConfirming(false)}>חזרה</button><button className="primary" disabled={saving} onClick={() => void performInventoryAction()}>{saving ? "שומר…" : "אישור ושמירת הכמות"}</button></div></> : <><h2>{inventoryAction.mode === "ADD" ? "עדכון כמות במלאי" : inventoryAction.mode === "REMOVE" ? "הפחתת מלאי" : "תיקון ספירה"}</h2><p><b>{inventoryAction.name}</b><span>כמות נוכחית: {inventoryAction.current} זרים</span></p><label>{inventoryAction.mode === "COUNT" ? "כמה זרים נמצאים בפועל?" : inventoryAction.mode === "ADD" ? "הכמות שתישמר במלאי" : "כמה זרים להפחית?"}<div className="inventory-amount-picker"><button type="button" onClick={() => setInventoryAmount(value => Math.max(inventoryAction.mode === "COUNT" || inventoryAction.mode === "ADD" ? 0 : 1, value - 1))} aria-label="הפחתת אחד">−</button><input type="number" inputMode="numeric" step="1" min={inventoryAction.mode === "COUNT" || inventoryAction.mode === "ADD" ? 0 : 1} max={inventoryAction.mode === "REMOVE" ? inventoryAction.current : 100000} value={inventoryAmount} onFocus={event => event.currentTarget.select()} onChange={event => setInventoryAmount(Math.max(0, Number.parseInt(event.target.value || "0", 10)))} /><button type="button" onClick={() => setInventoryAmount(value => value + 1)} aria-label="הוספת אחד">＋</button></div></label>{inventoryAction.mode === "ADD" && <><div className="inventory-quick-amounts">{[5, 10, 20].map(amount => <button type="button" key={amount} onClick={() => setInventoryAmount(inventoryAction.current + amount)}>+{amount}</button>)}</div><small className="field-help">כמות נוכחית: {inventoryAction.current} · כמות חדשה: {inventoryAmount}</small></>}<label>הערה לעדכון (לא חובה)<input value={inventoryReason} maxLength={500} onChange={event => setInventoryReason(event.target.value)} placeholder="לדוגמה: משלוח חדש" /><small className="field-help">ההערה אופציונלית ואינה מונעת שמירה</small></label><div><button className="secondary" onClick={() => { setInventoryAction(null); setInventoryConfirming(false); }}>ביטול</button><button className="primary" disabled={saving || !Number.isInteger(inventoryAmount) || (inventoryAction.mode === "ADD" && (inventoryAmount < 0 || inventoryAmount === inventoryAction.current)) || (inventoryAction.mode === "COUNT" && inventoryAmount < 0) || (inventoryAction.mode === "REMOVE" && (inventoryAmount < 1 || inventoryAmount > inventoryAction.current))} onClick={() => setInventoryConfirming(true)}>המשך לאימות</button></div></>}</SwipeSheet></div>}
    {editingProduct && <div className="modal-backdrop"><section className="modal inventory-action-sheet">
      <button className="modal-close" onClick={() => setEditingProduct(null)} aria-label="סגירה">×</button>
      <h2>עריכת סוג זר בעמדה</h2>
      <label>שם הזר<input value={productName} onChange={event => setProductName(event.target.value)} /></label>
      <label>מחיר מכירה<input type="number" inputMode="decimal" min="0.01" step="0.01" value={productPrice || ""} onChange={event => setProductPrice(Number(event.target.value))} /></label>
      <div><button className="secondary" onClick={() => setEditingProduct(null)}>ביטול</button><button className="primary" disabled={saving || productName.trim().length < 2 || !Number.isFinite(productPrice) || productPrice <= 0 || !Number.isInteger(productQuantity) || productQuantity < 0} onClick={() => void saveProduct()}>{saving ? "שומר…" : "שמירה"}</button></div>
    </section></div>}
    {addingProduct && selected && <div className="modal-backdrop"><SwipeSheet className="modal inventory-action-sheet" onDismiss={() => setAddingProduct(false)}><h2>הוספת סוג זר לעמדה</h2><p>מוצגים רק מוצרים פעילים שאינם פעילים כעת בעמדה.</p><label>סוג זר<select value={newProductId} onChange={event => selectProductForStation(event.target.value)}>{products.filter(product => product.active && !selected.inventory?.some(item => item.id === product.id && item.active)).map(product => <option value={product.id} key={product.id}>{product.name} — {product.price} ₪</option>)}</select></label><label>{selected.inventory?.some(item => item.id === newProductId) ? "כמות להוספה" : "כמות התחלתית"}<input type="number" inputMode="numeric" min="0" value={newProductQuantity} onFocus={event => event.currentTarget.select()} onChange={event => setNewProductQuantity(Math.max(0, Number.parseInt(event.target.value || "0", 10)))} /><small className="field-help">{selected.inventory?.some(item => item.id === newProductId) ? `הכמות הקיימת נשארת שמורה. יש להזין רק כמה זרים להוסיף.` : "זו הכמות שתישמר בעמדה לאחר ההוספה."}</small></label><div><button className="secondary" onClick={() => { setAddingProduct(false); setNewProductId(""); setNewProductQuantity(0); }}>ביטול</button><button className="primary" disabled={!newProductId || saving || !Number.isInteger(newProductQuantity) || newProductQuantity < 0} onClick={() => void addProduct()}>הוספה לעמדה</button></div></SwipeSheet></div>}
    {editing === "NEW" && <div className="modal-backdrop wizard-backdrop"><StationWizard products={products} saving={saving} onCancel={() => setEditing(null)} onSave={value => void save(value, "יצירת עמדה חדשה עם מלאי התחלתי")} onCreateProduct={async (name, price) => { try { const result = await productService.create(name, price) as { product: { id: string } }; await refresh(); notify("המוצר נוצר ונבחר לעמדה"); return result.product.id; } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן ליצור את המוצר"); return null; } }} /></div>}
    {editing && editing !== "NEW" && <div className="modal-backdrop"><section className="modal station-editor"><button className="modal-close" onClick={() => setEditing(null)} aria-label="סגירה">×</button><h2>עריכת עמדה</h2><StationForm initial={editing} onSave={save} onCancel={() => setEditing(null)} saving={saving} /></section></div>}
  </div>;
}

function StationSearch({ value, onChange, resultCount }: { value: string; onChange: (value: string) => void; resultCount: number }) {
  return <div className="station-search">
    <span aria-hidden="true">⌕</span>
    <input
      type="search"
      inputMode="search"
      enterKeyHint="search"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder="חיפוש עמדה לפי שם או מיקום"
      aria-label="חיפוש עמדה"
    />
    {value && <button type="button" onClick={() => onChange("")} aria-label="ניקוי החיפוש">ניקוי</button>}
    <small aria-live="polite">{resultCount} תוצאות</small>
  </div>;
}

function StationFilters({ filter, setFilter, active, inactive, archived, total }: { filter: Filter; setFilter: (value: Filter) => void; active: number; inactive: number; archived: number; total: number }) {
  return <div className="station-segmented" role="tablist">
    <button className={filter === "ACTIVE" ? "active" : ""} onClick={() => setFilter("ACTIVE")}>פעילות <span>{active}</span></button>
    <button className={filter === "INACTIVE" ? "active" : ""} onClick={() => setFilter("INACTIVE")}>לא פעילות <span>{inactive}</span></button>
    <button className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>הכל <span>{total}</span></button>
    <button className={filter === "ARCHIVED" ? "active" : ""} onClick={() => setFilter("ARCHIVED")}>ארכיון <span>{archived}</span></button>
  </div>;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "ללא הגבלה";
}

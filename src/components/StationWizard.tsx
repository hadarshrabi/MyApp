import { useEffect, useMemo, useRef, useState } from "react";
import { StationMap } from "./StationMap";
import type { StationInput } from "../services/stationService";
import { locationService } from "../services/locationService";
import type { GeocodeResult } from "../services/locationService";

type ProductOption = { id: string; name: string; price: number; active: boolean };
type Draft = StationInput & { products: Array<{ productId: string; initialQuantity: number }> };
const initial: Draft = {
  name: "", address: "", locationDescription: null, latitude: Number.NaN, longitude: Number.NaN,
  allowedRadiusMeters: 150, active: true, startDate: null, endDate: null, internalNotes: null, products: [],
};

export function StationWizard({ products, saving, onSave, onCancel, onCreateProduct }: {
  products: ProductOption[]; saving: boolean; onSave: (value: Draft) => void; onCancel: () => void;
  onCreateProduct?: (name: string, price: number) => Promise<string | null>;
}) {
  const [step, setStep] = useState(1);
  const [value, setValue] = useState<Draft>(initial);
  const [locationChosen, setLocationChosen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodeResult[]>([]);
  const [quickProduct, setQuickProduct] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPrice, setQuickPrice] = useState(0);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const activeProducts = useMemo(() => products.filter(item => item.active), [products]);
  const selectedProducts = activeProducts.filter(product => value.products.some(item => item.productId === product.id));
  const update = <K extends keyof Draft>(key: K, next: Draft[K]) => setValue(current => ({ ...current, [key]: next }));

  useEffect(() => {
    if (step !== 2 || addressQuery.trim().length < 3) { setAddressSuggestions([]); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true); setSearchError("");
      try { const results = await locationService.searchPlaces(addressQuery); if (!cancelled) setAddressSuggestions(results); }
      catch (error) { if (!cancelled) setSearchError(error instanceof Error ? error.message : "לא ניתן לחפש כרגע"); }
      finally { if (!cancelled) setSearching(false); }
    }, 650);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [addressQuery, step]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  function setProduct(productId: string, checked: boolean) {
    update("products", checked ? [...value.products, { productId, initialQuantity: 0 }] : value.products.filter(item => item.productId !== productId));
  }
  function setQuantity(productId: string, quantity: number) {
    update("products", value.products.map(item => item.productId === productId ? { ...item, initialQuantity: Math.max(0, quantity) } : item));
  }
  async function searchAddress() {
    if (addressQuery.trim().length < 3) return;
    setSearching(true); setSearchError("");
    try {
      const results = await locationService.searchPlaces(addressQuery);
      setAddressSuggestions(results);
      if (!results.length) setSearchError("לא נמצא מקום מתאים. ניתן לבחור נקודה ישירות במפה.");
    } catch (error) { setSearchError(error instanceof Error ? error.message : "חיפוש הכתובת נכשל. ניתן לבחור נקודה ישירות במפה."); }
    finally { setSearching(false); }
  }
  function chooseAddress(result: GeocodeResult) {
    update("address", result.label); update("locationDescription", addressQuery.trim());
    update("latitude", result.latitude); update("longitude", result.longitude);
    setLocationChosen(true); setAddressSuggestions([]); setSearchError("");
  }
  const canContinue = step === 1 ? value.name.trim().length >= 2 && (value.locationDescription?.trim().length || value.address.trim().length) :
    step === 2 ? locationChosen : true;

  return <section className="station-wizard" aria-label="אשף הוספת עמדה">
    <header><div><small>שלב {step} מתוך 4</small><h2>{["פרטים בסיסיים", "בחירת מיקום", "מלאי התחלתי", "סיכום עמדה"][step - 1]}</h2></div><button onClick={onCancel} aria-label="סגירה">×</button></header>
    <div className="wizard-progress"><i style={{ width: `${step * 25}%` }} /></div>
    <div className="wizard-body" ref={bodyRef}>
      {step === 1 && <div className="wizard-fields">
        <p>מתחילים בשם ותיאור שקל לזהות בשטח.</p>
        <label>שם העמדה<input autoFocus value={value.name} onChange={event => update("name", event.target.value)} placeholder="לדוגמה: תחנת אוטובוס צומת קדימה" /></label>
        <label>תיאור מיקום / כתובת<textarea value={value.locationDescription ?? ""} onChange={event => update("locationDescription", event.target.value || null)} placeholder="לדוגמה: תחנת אוטובוס ליד צומת קדימה" /></label>
      </div>}
      {step === 2 && <div className="wizard-location">
        <p>חפשו כתובת או בחרו את הנקודה המדויקת במפה. ניתן לגרור את הסמן לאחר הבחירה.</p>
        <div className="wizard-address-search"><label htmlFor="new-station-address-search">חיפוש כתובת או מקום</label><div className="address-search"><input id="new-station-address-search" value={addressQuery} onChange={event => setAddressQuery(event.target.value)} placeholder="לדוגמה: ההגנה 93 רעננה" autoComplete="off" inputMode="search" enterKeyHint="search" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void searchAddress(); } }} /><button className="secondary" onClick={() => void searchAddress()} disabled={searching}>{searching ? "מחפש…" : "חיפוש"}</button></div>{addressSuggestions.length > 0 && <div className="wizard-address-suggestions">{addressSuggestions.map(result => <button type="button" key={`${result.latitude}-${result.longitude}`} onClick={() => chooseAddress(result)}>{result.label}</button>)}</div>}</div>
        {searchError && <small className="wizard-error">{searchError}</small>}
        <div className="wizard-map"><StationMap stations={[]} placement={locationChosen ? { latitude: value.latitude, longitude: value.longitude } : null} onPlacementChange={point => { update("latitude", point.latitude); update("longitude", point.longitude); setLocationChosen(true); }} /></div>
        {locationChosen ? <div className="location-confirmed"><b>✓ מיקום אמיתי נבחר</b><span>גרירת הסמן או לחיצה נוספת על המפה תעדכן את הקואורדינטות</span><strong dir="ltr">{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</strong></div> : <div className="station-location-required">לא ניתן להמשיך בלי לבחור נקודה אמיתית במפה או לאשר שימוש ב־GPS.</div>}
        <div className="radius-picker"><b>רדיוס מותר להחתמת נוכחות</b><div>{[50, 100, 150, 250, 500].map(radius => <button className={value.allowedRadiusMeters === radius ? "active" : ""} onClick={() => update("allowedRadiusMeters", radius)} key={radius}>{radius} מ׳</button>)}</div></div>
      </div>}
      {step === 3 && <div className="wizard-products"><p>בחרו רק את סוגי הזרים שיהיו זמינים בעמדה ביום הפתיחה.</p>{onCreateProduct && <button className="secondary wizard-quick-product" onClick={() => setQuickProduct(value => !value)}>＋ יצירת סוג זר חדש</button>}{quickProduct && <section className="quick-product-form"><label>שם<input value={quickName} onChange={event => setQuickName(event.target.value)} placeholder="זר חג גדול" /></label><label>מחיר<input type="number" inputMode="decimal" min="0.01" step="0.01" value={quickPrice || ""} onChange={event => setQuickPrice(Number(event.target.value))} /></label><button className="primary" disabled={creatingProduct || quickName.trim().length < 2 || quickPrice <= 0} onClick={async () => { setCreatingProduct(true); const id = await onCreateProduct?.(quickName.trim(), quickPrice); setCreatingProduct(false); if (id) { setProduct(id, true); setQuickProduct(false); setQuickName(""); setQuickPrice(0); } }}>{creatingProduct ? "יוצר…" : "יצירה ובחירה"}</button></section>}{activeProducts.map(product => {
        const selected = value.products.find(item => item.productId === product.id);
        return <article className={selected ? "selected" : ""} key={product.id}><label><input type="checkbox" checked={Boolean(selected)} onChange={event => setProduct(product.id, event.target.checked)} /><span><b>{product.name}</b><small>{product.price} ₪</small></span></label>{selected && <label>כמות התחלתית<input className="initial-quantity-input" type="number" inputMode="numeric" min="0" placeholder="0" value={selected.initialQuantity === 0 ? "" : selected.initialQuantity} onChange={event => setQuantity(product.id, event.target.value === "" ? 0 : Number(event.target.value))} /></label>}</article>;
      })}</div>}
      {step === 4 && <div className="wizard-review">
        <section><h3>{value.name}</h3><p>{value.locationDescription || value.address}</p><span>רדיוס נוכחות: {value.allowedRadiusMeters} מ׳</span></section>
        <section><h3>מלאי התחלתי</h3>{selectedProducts.length ? selectedProducts.map(product => <p key={product.id}>{product.name} <b>× {value.products.find(item => item.productId === product.id)?.initialQuantity}</b></p>) : <p>ללא מלאי התחלתי</p>}</section>
      </div>}
    </div>
    <footer><button className="secondary" onClick={() => step === 1 ? onCancel() : setStep(step - 1)}>{step === 1 ? "ביטול" : "חזרה"}</button><button className="primary" disabled={!canContinue || saving} onClick={() => step < 4 ? setStep(step + 1) : onSave(value)}>{saving ? "יוצר עמדה…" : step === 4 ? "יצירת העמדה" : "המשך"}</button></footer>
  </section>;
}

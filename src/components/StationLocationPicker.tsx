import { useEffect, useRef, useState } from "react";
import { locationService } from "../services/locationService";
import { StationMap } from "./StationMap";

type Coordinates = { latitude: number; longitude: number };

export function StationLocationPicker({ initial, initialSearch = false, requestCurrentLocation = false, onConfirm, onCancel }: {
  initial: Coordinates | null;
  initialSearch?: boolean;
  requestCurrentLocation?: boolean;
  onConfirm: (coordinates: Coordinates, address?: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Coordinates | null>(initial);
  const [query, setQuery] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [results, setResults] = useState<Array<Coordinates & { label: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialSearch) window.setTimeout(() => searchRef.current?.focus(), 50);
    if (requestCurrentLocation) void useCurrentLocation();
  }, []);

  async function useCurrentLocation() {
    setLocating(true); setError("");
    try {
      const coordinates = await locationService.getCurrentPosition();
      setDraft({ latitude: coordinates.latitude, longitude: coordinates.longitude });
      setSelectedAddress("המיקום הנוכחי שלי");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "לא ניתן לקבל את המיקום הנוכחי");
    } finally { setLocating(false); }
  }

  async function search() {
    if (query.trim().length < 3) { setError("יש להקליד לפחות 3 תווים לחיפוש"); return; }
    setSearching(true); setError(""); setResults([]);
    try {
      const next = await locationService.searchPlaces(query);
      setResults(next);
      if (!next.length) setError("לא נמצא מקום מתאים. אפשר לבחור נקודה ישירות במפה.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "חיפוש המקום נכשל");
    } finally { setSearching(false); }
  }

  return <section className="location-picker" role="dialog" aria-modal="true" aria-label="בחירת מיקום עמדה">
    <header className="location-picker-header"><div><small>מיקום העמדה</small><h2>בחירת מיקום במפה</h2></div><button type="button" className="location-picker-cancel" onClick={onCancel}>ביטול</button></header>
    <div className="location-picker-search">
      <label htmlFor="station-location-search">חיפוש כתובת או מקום</label>
      <div><input ref={searchRef} id="station-location-search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} placeholder="לדוגמה: תחנת אוטובוס צומת קדימה" /><button type="button" className="secondary" disabled={searching} onClick={() => void search()}>{searching ? "מחפש…" : "חיפוש"}</button></div>
      {results.length > 0 && <div className="location-search-results">{results.map(result => <button type="button" key={`${result.latitude}-${result.longitude}`} onClick={() => { setDraft(result); setSelectedAddress(result.label); setResults([]); }}>{result.label}</button>)}</div>}
      {error && <p className="location-picker-error" role="alert">{error}</p>}
    </div>
    <div className="location-picker-map"><StationMap stations={[]} placement={draft} showLocateButton={false} onPlacementChange={coordinates => { setDraft(coordinates); if (selectedAddress !== "המיקום הנוכחי שלי") setSelectedAddress(""); }} /></div>
    <div className="location-picker-guidance">
      <p>{draft ? "✓ מיקום נבחר. אפשר לגרור את הסמן לדיוק מרבי." : "לחצו על המפה במקום המדויק שבו נמצאת העמדה."}</p>
      {selectedAddress && <small>{selectedAddress}</small>}
      <button type="button" className="secondary current-location-action" disabled={locating} onClick={() => void useCurrentLocation()}>{locating ? "מאתר מיקום…" : "◎ השתמש במיקום הנוכחי שלי"}</button>
    </div>
    <footer className="location-picker-actions"><button type="button" className="secondary" onClick={onCancel}>ביטול</button><button type="button" className="primary" disabled={!draft} onClick={() => draft && onConfirm(draft, selectedAddress || undefined)}>אישור מיקום</button></footer>
  </section>;
}

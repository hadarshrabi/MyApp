import { useEffect, useState } from "react";
import type { Station } from "../types/models";
import type { StationInput } from "../services/stationService";
import { StationLocationPicker } from "./StationLocationPicker";
import { StationMap } from "./StationMap";

const empty: StationInput = {
  name: "", address: "", locationDescription: null, latitude: Number.NaN, longitude: Number.NaN,
  allowedRadiusMeters: 150, active: true, startDate: null, endDate: null, internalNotes: null,
};

export function StationForm({ initial, coordinates, onSave, onCancel, saving = false }: {
  initial?: Station | null;
  coordinates?: { latitude: number; longitude: number } | null;
  onSave: (value: StationInput, reason: string) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [value, setValue] = useState<StationInput>(() => initial ? toInput(initial) : { ...empty, ...(coordinates ?? {}) });
  const [locationPicker, setLocationPicker] = useState<null | "MAP" | "SEARCH" | "GPS">(null);
  const [reason, setReason] = useState(initial ? "עדכון פרטי העמדה" : "יצירת עמדה חדשה");
  const hasLocation = Number.isFinite(value.latitude) && Number.isFinite(value.longitude);
  useEffect(() => {
    if (coordinates) setValue(current => ({ ...current, ...coordinates }));
  }, [coordinates?.latitude, coordinates?.longitude]);
  const update = <K extends keyof StationInput>(key: K, next: StationInput[K]) => setValue(current => ({ ...current, [key]: next }));
  const valid = value.name.trim().length >= 2 && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && reason.trim().length >= 3;
  return <form className="station-form" onSubmit={event => { event.preventDefault(); if (valid) onSave(value, reason); }}>
    <div className="station-form-grid">
      <label>שם העמדה<input value={value.name} onChange={event => update("name", event.target.value)} required placeholder="לדוגמה: תחנת אוטובוס צומת קדימה" /></label>
      <label className="wide-field">תיאור המיקום<textarea value={value.locationDescription ?? ""} onChange={event => update("locationDescription", event.target.value || null)} placeholder="ליד תחנת האוטובוס לכיוון תל אביב" /></label>
      <section className="station-location-field wide-field">
        <div><h3>מיקום העמדה</h3><p>{hasLocation ? value.address || value.locationDescription || "המיקום נקבע לפי הנקודה שנבחרה במפה" : "טרם נבחר מיקום אמיתי לעמדה"}</p></div>
        {hasLocation ? <><div className="station-location-preview"><StationMap stations={[]} placement={{ latitude: value.latitude, longitude: value.longitude }} showLocateButton={false} /></div><div className="selected-coordinate-proof"><b>✓ מיקום נבחר</b><span dir="ltr">{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</span></div></> : <div className="station-location-required">יש לבחור נקודה במפה, להשתמש ב־GPS או להזין קואורדינטות לפני השמירה.</div>}
        <div className="station-location-buttons">
          <button type="button" className="primary" onClick={() => setLocationPicker("MAP")}>בחירת מיקום במפה</button>
          <button type="button" className="secondary" onClick={() => setLocationPicker("GPS")}>השתמש במיקום הנוכחי שלי</button>
          <button type="button" className="secondary" onClick={() => setLocationPicker("SEARCH")}>חיפוש כתובת או מקום</button>
        </div>
        <details className="advanced-coordinates">
          <summary>הגדרות מתקדמות</summary>
          <div>
            <label>קו רוחב<input type="number" inputMode="decimal" step="0.000001" min="-90" max="90" value={hasLocation ? value.latitude : ""} onChange={event => update("latitude", event.target.value === "" ? Number.NaN : Number(event.target.value))} required /></label>
            <label>קו אורך<input type="number" inputMode="decimal" step="0.000001" min="-180" max="180" value={hasLocation ? value.longitude : ""} onChange={event => update("longitude", event.target.value === "" ? Number.NaN : Number(event.target.value))} required /></label>
          </div>
        </details>
      </section>
      <label>רדיוס נוכחות מותר במטרים<input type="number" min="10" max="5000" value={value.allowedRadiusMeters} onChange={event => update("allowedRadiusMeters", Number(event.target.value))} required /></label>
      <label>תאריך התחלה — לא חובה<input type="date" value={value.startDate?.slice(0, 10) ?? ""} onChange={event => update("startDate", event.target.value || null)} /></label>
      <label>תאריך סיום — לא חובה<input type="date" value={value.endDate?.slice(0, 10) ?? ""} onChange={event => update("endDate", event.target.value || null)} /></label>
      <label className="wide-field">הערות פנימיות<textarea value={value.internalNotes ?? ""} onChange={event => update("internalNotes", event.target.value || null)} /></label>
      {initial && <label className="wide-field">סיבת השינוי<input value={reason} minLength={3} onChange={event => setReason(event.target.value)} required /></label>}
    </div>
    <div className="station-form-actions"><button type="button" className="secondary" onClick={onCancel}>ביטול</button><button className="primary" disabled={!valid || saving}>{saving ? "שומר…" : initial ? "שמירת שינויים" : "יצירת עמדה"}</button></div>
    {locationPicker && <div className="location-picker-backdrop"><StationLocationPicker
      initial={hasLocation ? { latitude: value.latitude, longitude: value.longitude } : null}
      initialSearch={locationPicker === "SEARCH"}
      requestCurrentLocation={locationPicker === "GPS"}
      onCancel={() => setLocationPicker(null)}
      onConfirm={(point, address) => {
        setValue(current => ({ ...current, ...point, address: address || current.address }));
        setLocationPicker(null);
      }}
    /></div>}
  </form>;
}

function toInput(station: Station): StationInput {
  return {
    name: station.name, address: station.address ?? "", locationDescription: station.locationDescription ?? null,
    latitude: station.latitude, longitude: station.longitude, allowedRadiusMeters: station.allowedRadiusMeters,
    active: station.active, startDate: station.startDate ?? null, endDate: station.endDate ?? null,
    internalNotes: station.internalNotes ?? null,
  };
}

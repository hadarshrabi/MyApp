import { useMemo, useState } from "react";
import { PageIntro } from "../components/PageIntro";
import { StationMap } from "../components/StationMap";
import { StationForm } from "../components/StationForm";
import { useBusinessData } from "../context/BusinessDataContext";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { locationService } from "../services/locationService";
import { stationService, type StationInput } from "../services/stationService";

export function MapPage() {
  const { isAdmin, user } = useAuth();
  const { stations, refresh } = useBusinessData();
  const { notify } = useApp();
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [moveStationId, setMoveStationId] = useState("");
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [placement, setPlacement] = useState<{ latitude: number; longitude: number } | null>(null);
  const availableStations = useMemo(() => stations.filter(station => !station.archivedAt), [stations]);
  const visibleStations = useMemo(() => isAdmin ? availableStations.filter(station => showInactive || station.active) : availableStations.filter(station => station.active), [availableStations, isAdmin, showInactive]);
  const assignedStation = stations.find(station => station.id === user?.stationId);

  function beginCreate() {
    setMoving(false); setMoveStationId(""); setCreating(true); setPlacement(null); notify("לחץ על המפה במקום המדויק של העמדה");
  }
  function beginMove() {
    const station = stations.find(item => item.id === Number(moveStationId));
    if (!station) return notify("יש לבחור עמדה להזזה");
    setCreating(false); setMoving(true); setPlacement({ latitude: station.latitude, longitude: station.longitude });
    notify("גרור את הסמן הכתום למיקום החדש של העמדה");
  }
  async function useCurrentLocation() {
    try {
      const location = await locationService.getCurrentPosition();
      setPlacement({ latitude: Number(location.latitude.toFixed(6)), longitude: Number(location.longitude.toFixed(6)) });
      notify("המיקום הנוכחי הוזן. ניתן לגרור את הסמן לדיוק נוסף");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לקבל את המיקום"); }
  }
  async function save(value: StationInput) {
    setSaving(true);
    try { await stationService.create(value); await refresh(); setCreating(false); setPlacement(null); notify("העמדה נוצרה ונוספה למפה"); }
    catch (error) { notify(error instanceof Error ? error.message : "לא ניתן ליצור את העמדה"); }
    finally { setSaving(false); }
  }
  async function saveMovedLocation() {
    const station = stations.find(item => item.id === Number(moveStationId));
    if (!station || !placement) return;
    setSaving(true);
    try {
      await stationService.update(station.id, { latitude: placement.latitude, longitude: placement.longitude }, "שינוי מיקום העמדה מהמפה");
      await refresh(); setMoving(false); setPlacement(null); setMoveStationId(""); notify("מיקום העמדה עודכן ונשמר");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לעדכן את מיקום העמדה"); }
    finally { setSaving(false); }
  }

  return <div className={isAdmin ? "admin-map-page" : "employee-map-page"}>{isAdmin ? <PageIntro title="מפת עמדות" text="המפה מציגה עמדות דינמיות ממסד הנתונים. הקואורדינטות הן המיקום הקובע." /> : <header className="employee-map-header"><span>מפת העמדות שלי</span><h1>{assignedStation?.name ?? "עמדות פעילות באזור"}</h1><p>{visibleStations.length ? `${visibleStations.length} עמדות פעילות לצפייה וניווט` : "לא נמצאה עמדה פעילה להצגה"}</p></header>}
    {isAdmin && <div className="map-admin-toolbar">
      <button className="primary" onClick={beginCreate}>הוספת עמדה מהמפה</button>
      <div className="map-move-control"><select aria-label="בחירת עמדה להזזה" value={moveStationId} onChange={event => setMoveStationId(event.target.value)}><option value="">בחירת עמדה להזזה</option>{availableStations.map(station => <option value={station.id} key={station.id}>{station.name}</option>)}</select><button className="secondary" disabled={!moveStationId} onClick={beginMove}>שינוי מיקום</button></div>
      <label className="check"><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} />הצגת עמדות לא פעילות והיסטוריות</label>
    </div>}
    {creating && <section className="panel map-create-panel"><div className="map-create-head"><div><h3>מיקום עמדה חדשה</h3><p>{placement ? "הסמן ניתן לגרירה. הקואורדינטות מתעדכנות בזמן אמת." : "לחץ על המפה במקום המדויק של העמדה"}</p></div><button className="secondary" onClick={() => void useCurrentLocation()}>השתמש במיקום הנוכחי שלי</button></div>
      {placement ? <StationForm coordinates={placement} onSave={save} onCancel={() => { setCreating(false); setPlacement(null); }} saving={saving} /> : <div className="coordinate-waiting">ממתין לבחירת נקודה במפה…</div>}
    </section>}
    {moving && placement && <section className="map-move-banner"><div><small>הזזת עמדה</small><strong>{stations.find(item => item.id === Number(moveStationId))?.name}</strong><span dir="ltr">{placement.latitude.toFixed(6)}, {placement.longitude.toFixed(6)}</span></div><p>גרור את הסמן הכתום או לחץ על נקודה חדשה במפה.</p><div><button className="secondary" onClick={() => { setMoving(false); setPlacement(null); setMoveStationId(""); }}>ביטול</button><button className="primary" disabled={saving} onClick={() => void saveMovedLocation()}>{saving ? "שומר…" : "שמירת המיקום החדש"}</button></div></section>}
    {visibleStations.length || isAdmin ? <StationMap stations={visibleStations} placement={creating || moving ? placement : undefined} onPlacementChange={creating || moving ? setPlacement : undefined} showStationList={isAdmin} /> : <section className="employee-map-empty"><span>⌖</span><strong>אין כרגע עמדות פעילות</strong><small>יש לפנות למנהל כדי לבדוק את שיוך העמדה.</small></section>}
  </div>;
}

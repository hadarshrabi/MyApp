import { useEffect, useRef, useState } from "react";
import L, { type Map as LeafletMap, type Marker } from "leaflet";
import type { Station } from "../types/models";
import { locationService } from "../services/locationService";
import { useApp } from "../context/AppContext";

export function StationMap({ stations, placement, onPlacementChange, showLocateButton = true, showStationList = true }: {
  stations: Station[];
  placement?: { latitude: number; longitude: number } | null;
  onPlacementChange?: (coordinates: { latitude: number; longitude: number }) => void;
  showLocateButton?: boolean;
  showStationList?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const locationMarkerRef = useRef<Marker | null>(null);
  const draftMarkerRef = useRef<Marker | null>(null);
  const callbackRef = useRef(onPlacementChange);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const { notify } = useApp();
  callbackRef.current = onPlacementChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [31.8, 34.8], zoom: 8, zoomControl: true, scrollWheelZoom: true, dragging: true, touchZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    map.on("click", event => {
      if (!callbackRef.current) return;
      callbackRef.current({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) });
    });
    mapRef.current = map; setReady(true); window.setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(marker => marker.remove()); markersRef.current.clear();
    const icon = L.divIcon({ className: "station-marker-wrap", html: '<span class="station-marker">✿</span>', iconSize: [42, 48], iconAnchor: [21, 46], popupAnchor: [0, -43] });
    stations.forEach(station => {
      const marker = L.marker([station.latitude, station.longitude], { icon, title: station.name, opacity: station.active ? 1 : .48 }).addTo(map);
      const popup = document.createElement("div"); popup.className = "station-popup"; popup.dir = "rtl";
      const locationText = station.locationDescription || station.address || `${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)}`;
      popup.innerHTML = `<strong>${escapeHtml(station.name)}</strong><span>${escapeHtml(locationText)}</span><div><b>מצב:</b> ${station.active ? "פעילה" : "לא פעילה"}</div><div><b>מלאי נוכחי:</b> ${station.stock} זרים</div>`;
      const actions = document.createElement("div"); actions.className = "popup-actions";
      actions.append(navigationLink(`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`, "ניווט במפות גוגל"), navigationLink(`https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`, "ניווט ב־Waze"));
      popup.append(actions); marker.bindPopup(popup, { minWidth: 225 }); markersRef.current.set(station.id, marker);
    });
    if (stations.length && !placement) map.fitBounds(L.latLngBounds(stations.map(item => [item.latitude, item.longitude])), { padding: [35, 35], maxZoom: 15 });
  }, [stations, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!placement) { draftMarkerRef.current?.remove(); draftMarkerRef.current = null; return; }
    if (!draftMarkerRef.current) {
      draftMarkerRef.current = L.marker([placement.latitude, placement.longitude], {
        draggable: Boolean(callbackRef.current), zIndexOffset: 1000,
        icon: L.divIcon({ className: "draft-marker-wrap", html: '<span class="draft-marker">+</span>', iconSize: [46, 52], iconAnchor: [23, 50] }),
        title: "מיקום העמדה החדשה",
      }).addTo(map).bindTooltip("גרור למיקום המדויק", { permanent: false });
      draftMarkerRef.current.on("dragend", event => {
        const point = (event.target as Marker).getLatLng();
        callbackRef.current?.({ latitude: round(point.lat), longitude: round(point.lng) });
      });
      map.flyTo([placement.latitude, placement.longitude], Math.max(map.getZoom(), 17));
    } else draftMarkerRef.current.setLatLng([placement.latitude, placement.longitude]);
  }, [placement?.latitude, placement?.longitude, ready]);

  function focus(station: Station) {
    mapRef.current?.flyTo([station.latitude, station.longitude], 17, { duration: 0.7 });
    window.setTimeout(() => markersRef.current.get(station.id)?.openPopup(), 750);
  }
  async function locate() {
    setLocating(true);
    try {
      const coordinates = await locationService.getCurrentPosition();
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = L.marker([coordinates.latitude, coordinates.longitude], {
        icon: L.divIcon({ className: "user-marker-wrap", html: '<span class="user-marker"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }), title: "המיקום שלי",
      }).addTo(mapRef.current!).bindPopup("המיקום שלי");
      if (callbackRef.current) callbackRef.current({ latitude: round(coordinates.latitude), longitude: round(coordinates.longitude) });
      mapRef.current?.flyTo([coordinates.latitude, coordinates.longitude], 17);
      locationMarkerRef.current.openPopup(); notify("המפה התמקדה במיקום שלך");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לקבל את המיקום"); }
    finally { setLocating(false); }
  }

  return <section className="map-layout">{showStationList && stations.length > 0 && <button className="map-list-toggle" onClick={() => setListOpen(value => !value)} aria-expanded={listOpen}><span>רשימת עמדות</span><b>{stations.length}</b><i>{listOpen ? "⌄" : "⌃"}</i></button>}
    <div className="real-map-shell"><div ref={containerRef} className="real-map" aria-label="מפה אינטראקטיבית של עמדות הפרחים" />
    {!ready && <div className="map-loading">המפה נטענת…</div>}{showLocateButton && <button type="button" className="locate-button" onClick={locate} disabled={locating}>◎ {locating ? "מאתר מיקום…" : "השתמש במיקום הנוכחי שלי"}</button>}
    </div>
    {showStationList && stations.length > 0 && <aside className={`map-list ${listOpen ? "open" : ""}`}><div className="map-list-title"><div><h3>עמדות במפה</h3><p>{stations.length} עמדות מוצגות</p></div><button onClick={() => setListOpen(false)} aria-label="סגירת רשימת עמדות">×</button></div>
      {stations.map(station => <button className={`station-list-item ${station.active ? "" : "inactive"}`} key={station.id} onClick={() => { focus(station); setListOpen(false); }}><i>✿</i><div><b>{station.name}</b><small>{station.locationDescription || station.address || "לפי קואורדינטות"}</small><span>{station.active ? "פעילה" : "לא פעילה"} · {station.stock} זרים במלאי</span></div><strong>הצגה ←</strong></button>)}
    </aside>}</section>;
}

function round(value: number) { return Number(value.toFixed(6)); }
function navigationLink(href: string, label: string) { const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = label; return link; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!); }

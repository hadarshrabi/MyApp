import { useEffect, useRef, useState } from "react";
import L, { type Map as LeafletMap, type Marker } from "leaflet";
import type { Station } from "../types/models";
import { locationService } from "../services/locationService";
import { useApp } from "../context/AppContext";

export function StationMap({ stations }: { stations: Station[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const locationMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const { notify } = useApp();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [32.0853, 34.7818], zoom: 13, zoomControl: true, scrollWheelZoom: true, dragging: true, touchZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    const icon = L.divIcon({ className: "station-marker-wrap", html: '<span class="station-marker">✿</span>', iconSize: [42, 48], iconAnchor: [21, 46], popupAnchor: [0, -43] });
    stations.forEach(station => {
      const marker = L.marker([station.latitude, station.longitude], { icon, title: station.name }).addTo(map);
      const popup = document.createElement("div");
      popup.className = "station-popup"; popup.dir = "rtl";
      popup.innerHTML = `<strong>${station.name}</strong><span>${station.address}</span><div><b>מצב:</b> ${station.status}</div><div><b>מלאי נוכחי:</b> ${station.stock} זרים</div>`;
      const actions = document.createElement("div"); actions.className = "popup-actions";
      const google = document.createElement("a"); google.href = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`; google.target = "_blank"; google.rel = "noopener noreferrer"; google.textContent = "ניווט במפות גוגל";
      const waze = document.createElement("a"); waze.href = `https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`; waze.target = "_blank"; waze.rel = "noopener noreferrer"; waze.textContent = "ניווט ב־Waze";
      actions.append(google, waze); popup.append(actions); marker.bindPopup(popup, { minWidth: 225 }); markersRef.current.set(station.id, marker);
    });
    mapRef.current = map; setReady(true); window.setTimeout(() => map.invalidateSize(), 50);
    return () => { markersRef.current.clear(); map.remove(); mapRef.current = null; };
  }, [stations]);

  function focus(station: Station) {
    mapRef.current?.flyTo([station.latitude, station.longitude], 16, { duration: 0.8 });
    window.setTimeout(() => markersRef.current.get(station.id)?.openPopup(), 850);
    notify(`${station.name} מוצגת במפה`);
  }

  async function locate() {
    setLocating(true);
    try {
      const coordinates = await locationService.getCurrentPosition();
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = L.marker([coordinates.latitude, coordinates.longitude], {
        icon: L.divIcon({ className: "user-marker-wrap", html: '<span class="user-marker"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
        title: "המיקום שלי",
      }).addTo(mapRef.current!).bindPopup("המיקום שלי");
      mapRef.current?.flyTo([coordinates.latitude, coordinates.longitude], 16);
      locationMarkerRef.current.openPopup(); notify("המפה התמקדה במיקום שלך");
    } catch (error) { notify(error instanceof Error ? error.message : "לא ניתן לקבל את המיקום"); }
    finally { setLocating(false); }
  }

  return <section className="map-layout"><div className="real-map-shell"><div ref={containerRef} className="real-map" aria-label="מפה אינטראקטיבית של עמדות הפרחים" />
    {!ready && <div className="map-loading">המפה נטענת…</div>}<button className="locate-button" onClick={locate} disabled={locating}>◎ {locating ? "מאתר מיקום…" : "מיקום שלי"}</button></div>
    <aside className="map-list"><div className="map-list-title"><div><h3>עמדות באזור תל אביב</h3><p>{stations.length} עמדות מוצגות במפה</p></div><span>● פעילות</span></div>
      {stations.map(station => <button className="station-list-item" key={station.id} onClick={() => focus(station)}><i>✿</i><div><b>{station.name}</b><small>{station.address}</small><span>{station.status} · {station.stock} זרים במלאי</span></div><strong>הצגה במפה ←</strong></button>)}
    </aside></section>;
}

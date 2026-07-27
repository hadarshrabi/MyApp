"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { Stand } from "./page";

type Props = {
  stations: Stand[];
  onMessage: (message: string) => void;
};

export default function StationMap({ stations, onMessage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const locationMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [32.0853, 34.7818],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map);

      const stationIcon = L.divIcon({
        className: "station-marker-wrap",
        html: '<span class="station-marker">✿</span>',
        iconSize: [42, 48],
        iconAnchor: [21, 46],
        popupAnchor: [0, -43],
      });

      stations.forEach((station) => {
        const marker = L.marker([station.latitude, station.longitude], { icon: stationIcon, title: station.name }).addTo(map);
        const popup = document.createElement("div");
        popup.className = "station-popup";
        popup.dir = "rtl";
        popup.innerHTML = `
          <strong>${station.name}</strong>
          <span>${station.address}</span>
          <div><b>מצב:</b> ${station.status}</div>
          <div><b>מלאי נוכחי:</b> ${station.stock} זרים</div>
        `;
        const links = document.createElement("div");
        links.className = "popup-actions";
        const google = document.createElement("a");
        google.href = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;
        google.target = "_blank";
        google.rel = "noopener noreferrer";
        google.textContent = "ניווט במפות גוגל";
        const waze = document.createElement("a");
        waze.href = `https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`;
        waze.target = "_blank";
        waze.rel = "noopener noreferrer";
        waze.textContent = "ניווט ב־Waze";
        links.append(google, waze);
        popup.appendChild(links);
        marker.bindPopup(popup, { minWidth: 225 });
        markersRef.current.set(station.id, marker);
      });

      mapRef.current = map;
      setReady(true);
      window.setTimeout(() => map.invalidateSize(), 50);
    });

    return () => {
      cancelled = true;
      markersRef.current.clear();
      locationMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [stations]);

  function focusStation(station: Stand) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([station.latitude, station.longitude], 16, { duration: 0.8 });
    window.setTimeout(() => markersRef.current.get(station.id)?.openPopup(), 850);
    onMessage(`${station.name} מוצגת במפה`);
  }

  async function locateMe() {
    if (!navigator.geolocation) {
      onMessage("שירותי המיקום אינם נתמכים בדפדפן זה");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const L = await import("leaflet");
        const map = mapRef.current;
        if (!map) return;
        locationMarkerRef.current?.remove();
        locationMarkerRef.current = L.marker([coords.latitude, coords.longitude], {
          icon: L.divIcon({
            className: "user-marker-wrap",
            html: '<span class="user-marker"></span>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
          title: "המיקום שלי",
        }).addTo(map).bindPopup("המיקום שלי");
        map.flyTo([coords.latitude, coords.longitude], 16);
        locationMarkerRef.current.openPopup();
        setLocating(false);
        onMessage("המפה התמקדה במיקום שלך");
      },
      () => {
        setLocating(false);
        onMessage("לא ניתן לקבל את המיקום. יש לאשר גישה למיקום בדפדפן");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return <section className="map-layout">
    <div className="real-map-shell">
      <div ref={containerRef} className="real-map" aria-label="מפה אינטראקטיבית של עמדות הפרחים" />
      {!ready && <div className="map-loading">המפה נטענת…</div>}
      <button className="locate-button" onClick={locateMe} disabled={locating}>
        ◎ {locating ? "מאתר מיקום…" : "מיקום שלי"}
      </button>
    </div>
    <aside className="map-list">
      <div className="map-list-title"><div><h3>עמדות באזור תל אביב</h3><p>{stations.length} עמדות מוצגות במפה</p></div><span>● פעילות</span></div>
      {stations.map((station) => <button className="station-list-item" key={station.id} onClick={() => focusStation(station)}>
        <i>✿</i><div><b>{station.name}</b><small>{station.address}</small><span>{station.status} · {station.stock} זרים במלאי</span></div><strong>הצגה במפה ←</strong>
      </button>)}
    </aside>
  </section>;
}

import { useEffect, useRef } from "react";
import L, { type Map as LeafletMap } from "leaflet";
import type { ApiAttendance } from "../context/BusinessDataContext";

export function AttendanceExceptionMap({ record }: { record: ApiAttendance }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  useEffect(() => {
    if (!containerRef.current || !record.station?.latitude || !record.station.longitude) return;
    mapRef.current?.remove();
    const stationPoint: L.LatLngTuple = [record.station.latitude, record.station.longitude];
    const employeePoint: L.LatLngTuple = [record.latitude, record.longitude];
    const map = L.map(containerRef.current, { zoomControl: true, dragging: true, touchZoom: true, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    L.circle(stationPoint, { radius: record.station.allowedRadiusMeters ?? 150, color: "#456b58", fillColor: "#7ca58e", fillOpacity: .12 }).addTo(map);
    L.marker(stationPoint).addTo(map).bindPopup("העמדה");
    L.circleMarker(employeePoint, { radius: 9, color: "#fff", weight: 3, fillColor: "#d75a45", fillOpacity: 1 }).addTo(map).bindPopup("המיקום שנרשם");
    L.polyline([stationPoint, employeePoint], { color: "#d75a45", dashArray: "7 7", weight: 3 }).addTo(map);
    map.fitBounds(L.latLngBounds([stationPoint, employeePoint]).pad(.35), { maxZoom: 17 });
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 80);
    return () => { map.remove(); mapRef.current = null; };
  }, [record]);
  return <div className="exception-map" ref={containerRef} aria-label="מפת מיקום חריגת הנוכחות" />;
}

import { PageIntro } from "../components/PageIntro";
import { StationMap } from "../components/StationMap";
import { stations } from "../data/mockData";
import { useAuth } from "../context/AuthContext";

export function MapPage() {
  const { isAdmin, user } = useAuth();
  const visibleStations = isAdmin ? stations : stations.filter(station => station.id === user.stationId);
  return <><PageIntro title="מפת עמדות" text={isAdmin ? "מיקומי העמדות, כתובות וניווט מהיר בזמן אמת." : "מיקום העמדה שלך וניווט מהיר."} action={isAdmin ? "נעיצת עמדה חדשה" : undefined} /><StationMap stations={visibleStations} /></>;
}

import { PageIntro } from "../components/PageIntro";
import { StationMap } from "../components/StationMap";
import { stations } from "../data/mockData";

export function MapPage() {
  return <><PageIntro title="מפת עמדות" text="מיקומי העמדות, כתובות וניווט מהיר בזמן אמת." action="נעיצת עמדה חדשה" /><StationMap stations={stations} /></>;
}

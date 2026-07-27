import { useState } from "react";
import { attendanceService } from "../services/attendanceService";
import type { Station } from "../types/models";

export function useAttendance() {
  const [loading, setLoading] = useState(false);
  async function clock(station: Station, action: "CLOCK_IN" | "CLOCK_OUT") {
    setLoading(true);
    try { return await attendanceService.clock(station, action); }
    finally { setLoading(false); }
  }
  return { clock, loading };
}

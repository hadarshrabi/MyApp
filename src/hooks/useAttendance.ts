import { useState } from "react";
import { attendanceService } from "../services/attendanceService";
import type { Station } from "../types/models";

export function useAttendance() {
  const [loading, setLoading] = useState(false);
  async function clock(employeeId: string, station: Station, action: "כניסה" | "יציאה") {
    setLoading(true);
    try { return await attendanceService.clock(employeeId, station, action); }
    finally { setLoading(false); }
  }
  return { clock, loading };
}

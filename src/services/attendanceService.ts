import type { AttendanceRecord, Station } from "../types/models";
import { locationService } from "./locationService";
import { distanceInMeters } from "../utils/distance";

export const attendanceService = {
  async clock(employeeId: string, station: Station, action: "כניסה" | "יציאה", allowedRadius = 150): Promise<AttendanceRecord> {
    const position = await locationService.getCurrentPosition();
    const distanceMeters = distanceInMeters(position, station);
    return {
      id: crypto.randomUUID(),
      employeeId,
      stationId: station.id,
      action,
      latitude: position.latitude,
      longitude: position.longitude,
      distanceMeters,
      timestamp: new Date().toISOString(),
      approved: distanceMeters <= allowedRadius,
    };
  },
};

import type { AttendanceRecord, Station } from "../types/models";
import { locationService } from "./locationService";
import { Capacitor } from "@capacitor/core";

export const attendanceService = {
  async clock(station: Station, action: "CLOCK_IN" | "CLOCK_OUT"): Promise<AttendanceRecord> {
    const position = await locationService.getCurrentPosition();
    const response = await fetch("/api/attendance/clock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        stationId: station.id,
        latitude: position.latitude,
        longitude: position.longitude,
        gpsAccuracy: position.accuracy,
        deviceInfo: `${Capacitor.getPlatform()} · ${navigator.userAgent}`,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "לא ניתן לשמור את הדיווח");
    return {
      id: payload.record.id,
      employeeId: payload.record.employeeId,
      stationId: payload.record.stationId,
      action: payload.record.action,
      latitude: payload.record.latitude,
      longitude: payload.record.longitude,
      distanceMeters: payload.record.distanceMeters,
      timestamp: payload.record.serverTimestamp,
      gpsAccuracy: payload.record.gpsAccuracy,
      deviceInfo: payload.record.deviceInfo,
      approved: !payload.record.exceptional,
    };
  },
  async ownRecords(): Promise<AttendanceRecord[]> {
    const response = await fetch("/api/attendance/me");
    if (!response.ok) throw new Error("לא ניתן לטעון את הנוכחות");
    return (await response.json()).records;
  },
};

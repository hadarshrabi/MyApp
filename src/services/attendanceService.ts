import type { AttendanceRecord, Station } from "../types/models";
import { locationService } from "./locationService";
import { Capacitor } from "@capacitor/core";
import { apiClient } from "./apiClient";

export const attendanceService = {
  async clock(station: Station, action: "CLOCK_IN" | "CLOCK_OUT"): Promise<AttendanceRecord> {
    const position = await locationService.getCurrentPosition();
    const payload = await apiClient.post<{ record: any }>("/api/attendance/clock", {
        action,
        stationId: station.id,
        latitude: position.latitude,
        longitude: position.longitude,
        gpsAccuracy: position.accuracy,
        deviceInfo: `${Capacitor.getPlatform()} · ${navigator.userAgent}`,
    });
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
    return (await apiClient.get<{ records: AttendanceRecord[] }>("/api/attendance/me")).records;
  },
};

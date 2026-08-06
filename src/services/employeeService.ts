import { apiClient } from "./apiClient";

export const employeeService = {
  assignStation(employeeId: string, stationId: number | null) {
    return apiClient.patch(`/api/admin/employees/${encodeURIComponent(employeeId)}/station`, {
      stationId,
      reason: stationId === null ? "הסרת שיוך עובד מעמדה" : "שינוי שיוך עובד לעמדה",
    });
  },
};

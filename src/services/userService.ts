import { apiClient } from "./apiClient";

export type ManagedUserInput = {
  displayName: string;
  email: string;
  systemRole: "ADMIN" | "EMPLOYEE";
  jobPosition?: string;
  hourlyRate?: number;
  assignedStationId?: number | null;
};

export const userService = {
  create(input: ManagedUserInput & { password: string }) {
    return apiClient.post("/api/admin/users", input);
  },
  update(userId: string, input: Partial<ManagedUserInput> & { reason?: string }) {
    return apiClient.patch(`/api/admin/users/${encodeURIComponent(userId)}`, input);
  },
  setActive(userId: string, active: boolean) {
    return apiClient.post(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      active,
      reason: active ? "החזרת גישה למשתמש" : "השבתת גישת משתמש",
    });
  },
  resetPassword(userId: string, password: string) {
    return apiClient.post<{ success: true }>(`/api/admin/users/${encodeURIComponent(userId)}/password`, { password });
  },
};

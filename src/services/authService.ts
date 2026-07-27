import type { CurrentUser } from "../types/models";

const demoAdmin: CurrentUser = {
  id: "user-1",
  name: "לינוי רז",
  role: "ADMIN",
  permissions: ["ADMIN_FULL_ACCESS", "CLOCK_ATTENDANCE", "VIEW_OWN_ATTENDANCE", "REPORT_SALE", "VIEW_ASSIGNED_INVENTORY"],
};

export const authService = {
  async currentUser(): Promise<CurrentUser> { return demoAdmin; },
  async signOut(): Promise<void> { return; },
};

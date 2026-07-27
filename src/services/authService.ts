import type { CurrentUser } from "../types/models";

const demoAdmin: CurrentUser = {
  id: "user-1",
  name: "לינוי רז",
  role: "admin",
  permissions: ["view_payroll", "manage_employees", "manage_inventory", "manage_users", "clock_attendance"],
};

export const authService = {
  async currentUser(): Promise<CurrentUser> { return demoAdmin; },
  async signOut(): Promise<void> { return; },
};

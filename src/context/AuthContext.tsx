import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CurrentUser, Permission } from "../types/models";

const demoUser: CurrentUser = {
  id: "user-1",
  name: "לינוי רז",
  role: "admin",
  permissions: ["view_payroll", "manage_employees", "manage_inventory", "manage_users", "clock_attendance"],
};

type AuthValue = { user: CurrentUser; can: (permission: Permission) => boolean };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ user: demoUser, can: (permission: Permission) => demoUser.permissions.includes(permission) }), []);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider חסר");
  return value;
}

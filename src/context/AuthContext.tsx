import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CurrentUser, Permission, UserRole } from "../types/models";

const adminPermissions: Permission[] = ["ADMIN_FULL_ACCESS", "CLOCK_ATTENDANCE", "VIEW_OWN_ATTENDANCE", "REPORT_SALE", "VIEW_ASSIGNED_INVENTORY"];
const employeePermissions: Permission[] = ["CLOCK_ATTENDANCE", "VIEW_OWN_ATTENDANCE", "REPORT_SALE", "VIEW_ASSIGNED_INVENTORY"];

function demoUser(role: UserRole): CurrentUser {
  return role === "ADMIN"
    ? { id: "user-admin", name: "לינוי רז", role, permissions: adminPermissions }
    : { id: "user-employee-1", employeeId: "emp-1", stationId: 1, name: "מיה אדרי", role, jobPosition: "מוכרת", permissions: employeePermissions };
}

type AuthValue = { user: CurrentUser; isAdmin: boolean; can: (permission: Permission) => boolean };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const role: UserRole = new URLSearchParams(window.location.search).get("demoRole") === "employee" ? "EMPLOYEE" : "ADMIN";
  const user = useMemo(() => demoUser(role), [role]);
  const value = useMemo(() => ({
    user,
    isAdmin: user.role === "ADMIN",
    can: (permission: Permission) => user.role === "ADMIN" || user.permissions.includes(permission),
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider חסר");
  return value;
}

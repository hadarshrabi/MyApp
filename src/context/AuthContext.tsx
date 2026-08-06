import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CurrentUser, Permission } from "../types/models";
import { authService } from "../services/authService";
import type { ApiUser } from "../services/apiClient";

const adminPermissions: Permission[] = ["ADMIN_FULL_ACCESS", "CLOCK_ATTENDANCE", "VIEW_OWN_ATTENDANCE", "REPORT_SALE", "VIEW_ASSIGNED_INVENTORY"];
const employeePermissions: Permission[] = ["CLOCK_ATTENDANCE", "VIEW_OWN_ATTENDANCE", "REPORT_SALE", "VIEW_ASSIGNED_INVENTORY"];

function mapUser(user: ApiUser): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    role: user.systemRole,
    employeeId: user.employee?.id,
    stationId: user.employee?.assignedStationId ?? undefined,
    jobPosition: user.employee?.jobPosition,
    permissions: user.systemRole === "ADMIN" ? adminPermissions : employeePermissions,
  };
}

type AuthValue = {
  user: CurrentUser | null;
  loading: boolean;
  isAdmin: boolean;
  can: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void authService.restore().then(value => setUser(value ? mapUser(value) : null)).finally(() => setLoading(false)); }, []);
  const login = useCallback(async (email: string, password: string) => setUser(mapUser(await authService.login(email, password))), []);
  const logout = useCallback(async () => { await authService.signOut(); setUser(null); }, []);
  const value = useMemo(() => ({
    user, loading, isAdmin: user?.role === "ADMIN",
    can: (permission: Permission) => user?.role === "ADMIN" || Boolean(user?.permissions.includes(permission)),
    login, logout,
  }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("חסר AuthProvider");
  return value;
}

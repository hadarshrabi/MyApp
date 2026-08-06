import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useApp } from "./AppContext";
import { useBusinessData, type ApiAttendance } from "./BusinessDataContext";
import { apiClient } from "../services/apiClient";

type ExceptionsValue = {
  records: ApiAttendance[];
  pendingCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  approve: (id: string, reason?: string) => Promise<void>;
  reject: (id: string, reason: string) => Promise<void>;
};
const AttendanceExceptionsContext = createContext<ExceptionsValue | null>(null);

export function AttendanceExceptionsProvider({ children }: { children: ReactNode }) {
  const { isAdmin, user } = useAuth();
  const { notify } = useApp();
  const business = useBusinessData();
  const [records, setRecords] = useState<ApiAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const previousPending = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const payload = await apiClient.get<{ records: ApiAttendance[] }>("/api/admin/attendance/exceptions");
      const pending = payload.records.filter(record => record.exceptionStatus === "PENDING").length;
      if (previousPending.current !== null && pending > previousPending.current) notify("נוספה חריגת נוכחות חדשה");
      previousPending.current = pending;
      setRecords(payload.records);
    } finally { setLoading(false); }
  }, [isAdmin, notify]);

  useEffect(() => {
    if (!isAdmin) { setRecords([]); previousPending.current = null; return; }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [isAdmin, user?.id, refresh]);

  async function review(id: string, decision: "approve" | "reject", reason?: string) {
    await apiClient.post(`/api/admin/attendance/${id}/${decision}`, reason ? { reason } : {});
    notify(decision === "approve" ? "חריגת הנוכחות אושרה" : "חריגת הנוכחות נדחתה");
    await Promise.all([refresh(), business.refresh()]);
  }

  return <AttendanceExceptionsContext.Provider value={{
    records,
    pendingCount: records.filter(record => record.exceptionStatus === "PENDING").length,
    loading,
    refresh,
    approve: (id, reason) => review(id, "approve", reason),
    reject: (id, reason) => review(id, "reject", reason),
  }}>{children}</AttendanceExceptionsContext.Provider>;
}

export function useAttendanceExceptions() {
  const value = useContext(AttendanceExceptionsContext);
  if (!value) throw new Error("חסר AttendanceExceptionsProvider");
  return value;
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { apiClient } from "../services/apiClient";
import type { Employee, Station } from "../types/models";

type ProductView = { id: string; name: string; price: number; count: number; active: boolean; stations: Array<{ stationId: number; name: string; quantity: number; active: boolean }> };
export type ApiAttendance = {
  id: string; employeeId: string; stationId: number; action: "CLOCK_IN" | "CLOCK_OUT";
  serverTimestamp: string; latitude: number; longitude: number; gpsAccuracy?: number | null;
  distanceMeters: number; deviceInfo?: string | null; exceptional: boolean;
  exceptionStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt?: string | null; reviewReason?: string | null;
  station?: { name: string; address?: string; latitude?: number; longitude?: number; allowedRadiusMeters?: number };
  employee?: { user: { displayName: string }; jobPosition: string };
};
export type AuditView = { id: string; serverTimestamp: string; entityType: string; entityId: string; fieldName: string; originalValue: unknown; newValue: unknown; reason: string; adminUser: { displayName: string } };
export type UserView = { id: string; email: string; displayName: string; systemRole: "ADMIN" | "EMPLOYEE"; active: boolean; employee: null | { id: string; jobPosition: string; hourlyRateCents: number; assignedStationId: number | null; assignedStation: { name: string } | null } };
type RawInventory = { quantity: number; active: boolean; product: { id: string; name: string; currentPriceCents: number; active: boolean } };
type RawStation = { id: number; name: string; address: string; locationDescription?: string | null; latitude: number; longitude: number; allowedRadiusMeters: number; active: boolean; startDate?: string | null; endDate?: string | null; internalNotes?: string | null; archivedAt?: string | null; archivedByAdminId?: string | null; archiveReason?: string | null; inventory?: RawInventory[]; _count?: { employees: number } };
type BusinessValue = {
  loading: boolean; error: string; refresh: () => Promise<void>;
  stations: Station[]; employees: Employee[]; products: ProductView[];
  attendance: ApiAttendance[]; audits: AuditView[]; users: UserView[];
  employeeInventory: ProductView[];
  employeeProfile?: { hourlyRateCents: number; jobPosition: string; totalMinutes: number; estimatedPayCents: number };
};
const BusinessDataContext = createContext<BusinessValue | null>(null);

export function BusinessDataProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  async function refresh() {
    if (!user) { setRaw(null); return; }
    setLoading(true); setError("");
    try { setRaw(await apiClient.get(isAdmin ? "/api/admin/bootstrap" : "/api/employee/home")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "לא ניתן לטעון את נתוני המערכת"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [user?.id, isAdmin]);

  const value = useMemo<BusinessValue>(() => {
    const rawStations: RawStation[] = isAdmin ? raw?.stations ?? [] : raw?.nearbyStations ?? (raw?.station ? [raw.station] : []);
    const attendance: ApiAttendance[] = raw?.attendance ?? [];
    const sales = raw?.sales ?? [];
    const stations = rawStations.map(station => {
      const stationInventory = station.inventory ?? [];
      const stock = stationInventory.filter(item => item.active && item.product.active).reduce((sum, item) => sum + item.quantity, 0);
      const revenue = sales.filter((sale: any) => sale.stationId === station.id).reduce((sum: number, sale: any) => sum + sale.totalAmountCents / 100, 0);
      return { id: station.id, name: station.name, address: station.address, locationDescription: station.locationDescription, latitude: station.latitude, longitude: station.longitude, allowedRadiusMeters: station.allowedRadiusMeters, active: station.active, startDate: station.startDate, endDate: station.endDate, internalNotes: station.internalNotes, archivedAt: station.archivedAt, archivedByAdminId: station.archivedByAdminId, archiveReason: station.archiveReason, inventory: stationInventory.map(item => ({ id: item.product.id, name: item.product.name, price: item.product.currentPriceCents / 100, quantity: item.quantity, active: item.active && item.product.active })), stock, target: Math.max(stock, 40), revenue, status: stock < 15 ? "דורשת טיפול" as const : "פתוחה" as const };
    });
    const users: UserView[] = raw?.users ?? [];
    const employees = users.filter(item => item.active && item.employee).map((item, index) => {
      const employee = item.employee!;
      const latest = attendance.find(record => record.employeeId === employee.id);
      const records = attendance.filter(record => record.employeeId === employee.id).sort((a, b) => new Date(a.serverTimestamp).getTime() - new Date(b.serverTimestamp).getTime());
      let totalMinutes = 0;
      for (let recordIndex = 0; recordIndex < records.length - 1; recordIndex += 1) {
        if (records[recordIndex].action === "CLOCK_IN" && records[recordIndex + 1].action === "CLOCK_OUT") {
          totalMinutes += Math.max(0, (new Date(records[recordIndex + 1].serverTimestamp).getTime() - new Date(records[recordIndex].serverTimestamp).getTime()) / 60000);
          recordIndex += 1;
        }
      }
      return {
        id: employee.id, initials: item.displayName.split(" ").map(part => part[0]).join("").slice(0, 2), name: item.displayName,
        station: employee.assignedStation?.name ?? "ללא עמדה", stationId: employee.assignedStationId ?? 0, role: employee.jobPosition,
        start: latest?.action === "CLOCK_IN" ? new Date(latest.serverTimestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—",
        hours: `${Math.floor(totalMinutes / 60)}:${String(Math.round(totalMinutes % 60)).padStart(2, "0")}`, hourlyRate: employee.hourlyRateCents / 100,
        status: latest?.action === "CLOCK_IN" ? "במשמרת" as const : "לא במשמרת" as const,
        color: ["lavender", "mint", "peach", "blue", "pink"][index % 5],
      };
    });
    const inventoryRows: RawInventory[] = isAdmin ? rawStations.flatMap(station => station.inventory ?? []) : (raw?.station?.inventory ?? []);
    const productSource = isAdmin ? raw?.products ?? [] : inventoryRows.map(item => item.product);
    const products = productSource.map((product: any) => ({
      id: product.id, name: product.name, price: product.currentPriceCents / 100, active: product.active ?? true,
      count: inventoryRows.filter(item => item.product.id === product.id && item.active && item.product.active).reduce((sum, item) => sum + item.quantity, 0),
      stations: (product.stationInventory ?? []).map((item: any) => ({ stationId: item.stationId, name: item.station.name, quantity: item.quantity, active: item.active })),
    }));
    return { loading, error, refresh, stations, employees, products, attendance, audits: raw?.audits ?? [], users, employeeInventory: products, employeeProfile: raw?.employeeProfile };
  }, [raw, loading, error, isAdmin]);
  return <BusinessDataContext.Provider value={value}>{children}</BusinessDataContext.Provider>;
}

export function useBusinessData() {
  const value = useContext(BusinessDataContext);
  if (!value) throw new Error("חסר BusinessDataProvider");
  return value;
}

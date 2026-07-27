export type UserRole = "ADMIN" | "EMPLOYEE";
export type Permission =
  | "ADMIN_FULL_ACCESS"
  | "CLOCK_ATTENDANCE"
  | "VIEW_OWN_ATTENDANCE"
  | "REPORT_SALE"
  | "VIEW_ASSIGNED_INVENTORY";

export type Station = {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  stock: number;
  target: number;
  revenue: number;
  status: "פתוחה" | "דורשת טיפול";
};

export type Employee = {
  id: string;
  initials: string;
  name: string;
  station: string;
  stationId: number;
  role: string;
  start: string;
  hours: string;
  hourlyRate: number;
  status: "במשמרת" | "לא במשמרת";
  color: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  stationId: number;
  action: "CLOCK_IN" | "CLOCK_OUT";
  latitude: number;
  longitude: number;
  distanceMeters: number;
  timestamp: string;
  gpsAccuracy?: number | null;
  deviceInfo?: string | null;
  approved: boolean;
};

export type CurrentUser = {
  id: string;
  name: string;
  role: UserRole;
  employeeId?: string;
  stationId?: number;
  jobPosition?: string;
  permissions: Permission[];
};

export type UserRole = "admin" | "manager" | "employee";
export type Permission = "view_payroll" | "manage_employees" | "manage_inventory" | "manage_users" | "clock_attendance";

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
  action: "כניסה" | "יציאה";
  latitude: number;
  longitude: number;
  distanceMeters: number;
  timestamp: string;
  approved: boolean;
};

export type CurrentUser = {
  id: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
};

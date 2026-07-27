import type { Employee, Station } from "../types/models";

export const stations: Station[] = [
  { id: 1, name: "עמדת עזריאלי", address: "דרך מנחם בגין 132, תל אביב", latitude: 32.0743, longitude: 34.7925, stock: 38, target: 45, revenue: 4260, status: "פתוחה" },
  { id: 2, name: "עמדת שרונה", address: "אלוף קלמן מגן 3, תל אביב", latitude: 32.0717, longitude: 34.7876, stock: 12, target: 40, revenue: 3180, status: "דורשת טיפול" },
  { id: 3, name: "עמדת דיזנגוף", address: "דיזנגוף 50, תל אביב", latitude: 32.0754, longitude: 34.7741, stock: 29, target: 35, revenue: 2840, status: "פתוחה" },
  { id: 4, name: "עמדת רמת אביב", address: "איינשטיין 40, תל אביב", latitude: 32.1120, longitude: 34.7956, stock: 33, target: 40, revenue: 2560, status: "פתוחה" },
];

export const employees: Employee[] = [
  { id: "emp-1", initials: "מע", name: "מיה אדרי", station: "עזריאלי", stationId: 1, role: "מוכרת", start: "08:02", hours: "6:13", hourlyRate: 42, status: "במשמרת", color: "lavender" },
  { id: "emp-2", initials: "די", name: "דניאל ישראלי", station: "שרונה", stationId: 2, role: "אחמ״ש", start: "09:15", hours: "5:00", hourlyRate: 55, status: "במשמרת", color: "mint" },
  { id: "emp-3", initials: "נכ", name: "נועה כהן", station: "דיזנגוף", stationId: 3, role: "שוזרת", start: "10:01", hours: "4:14", hourlyRate: 48, status: "במשמרת", color: "peach" },
  { id: "emp-4", initials: "רי", name: "רון יצחק", station: "רמת אביב", stationId: 4, role: "מוכר", start: "11:30", hours: "2:45", hourlyRate: 40, status: "במשמרת", color: "blue" },
  { id: "emp-5", initials: "שא", name: "שירה אברהם", station: "עזריאלי", stationId: 1, role: "שוזרת", start: "—", hours: "0:00", hourlyRate: 47, status: "לא במשמרת", color: "pink" },
];

export const bouquets = [
  { id: 1, name: "זר ורדים לבנים", price: 189, count: 16 },
  { id: 2, name: "זר שדה אביבי", price: 149, count: 9 },
  { id: 3, name: "זר ורוד חגיגי", price: 219, count: 7 },
  { id: 4, name: "זר קטן לדרך", price: 89, count: 6 },
];

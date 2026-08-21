export type AuditRecord = {
  id: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  originalValue: unknown;
  newValue: unknown;
  reason?: string | null;
  serverTimestamp: string;
  adminUser: { displayName: string };
};

export type ActivityCategory = "EMPLOYEES" | "USERS" | "ATTENDANCE" | "STATIONS" | "INVENTORY" | "PRODUCTS" | "SYSTEM";
export type ActivityChange = { label: string; before: string; after: string };
export type ActivityItem = {
  id: string; actor: string; initials: string; description: string; target?: string;
  category: ActivityCategory; categoryLabel: string; timestamp: string; reason?: string;
  changes: ActivityChange[]; technical: { entityType: string; fieldName: string };
};

export type ActivityResolvers = {
  users?: Array<{ id: string; displayName: string; employee?: { id: string } | null }>;
  stations?: Array<{ id: number; name: string }>;
  products?: Array<{ id: string; name: string }>;
  attendance?: Array<{ id: string; employee?: { user?: { displayName?: string } } }>;
};

const categoryMap: Record<string, [ActivityCategory, string]> = {
  USER: ["USERS", "משתמשים"], EMPLOYEE: ["EMPLOYEES", "עובדים"],
  ATTENDANCE: ["ATTENDANCE", "נוכחות"], STATION: ["STATIONS", "עמדות"],
  INVENTORY: ["INVENTORY", "מלאי"], PRODUCT: ["PRODUCTS", "מוצרים"],
};

const fieldLabels: Record<string, string> = {
  displayName: "שם", email: "דוא״ל", systemRole: "הרשאה", jobPosition: "תפקיד",
  hourlyRateCents: "שכר שעתי", assignedStationId: "עמדה", active: "סטטוס",
  quantity: "כמות במלאי", name: "שם", currentPriceCents: "מחיר", price: "מחיר",
  serverTimestamp: "מועד", stationId: "עמדה", action: "סוג דיווח",
  clockIn: "כניסה", clockOut: "יציאה", stationName: "עמדה",
  exceptional: "דיווח חריג", exceptionStatus: "סטטוס חריגה",
};

const allowedChangeFields = new Set(Object.keys(fieldLabels));
const sensitivePattern = /(password|hash|token|secret|cookie|authorization|database.?url|jwt)/i;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, field = ""): string {
  if (value === null || value === undefined || value === "") return "ללא ערך";
  if (field === "active") return value ? "פעיל" : "לא פעיל";
  if (field === "exceptional") return value ? "חריג" : "רגיל";
  if (field === "hourlyRateCents" || field === "currentPriceCents") return `${Number(value) / 100} ₪`;
  if (field === "price") return `${Number(value)} ₪`;
  if (field === "systemRole") return value === "ADMIN" ? "מנהל" : value === "EMPLOYEE" ? "עובד" : "תפקיד מערכת";
  if (field === "action") return value === "CLOCK_IN" ? "כניסה" : value === "CLOCK_OUT" ? "יציאה" : "דיווח נוכחות";
  if (field === "exceptionStatus") return value === "APPROVED" ? "אושר" : value === "REJECTED" ? "נדחה" : value === "PENDING" ? "ממתין לבדיקה" : "עודכן";
  if (field === "assignedStationId" || field === "stationId") {
    const record = object(value);
    return typeof record?.name === "string" ? record.name : value === null ? "ללא עמדה" : "עמדה אחרת";
  }
  if (typeof value === "boolean") return value ? "כן" : "לא";
  if (typeof value === "number") return new Intl.NumberFormat("he-IL").format(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" });
    return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  }
  const record = object(value);
  if (record && typeof record.name === "string") return record.name;
  return "עודכן";
}

function safeChanges(record: AuditRecord): ActivityChange[] {
  const before = object(record.originalValue);
  const after = object(record.newValue);
  if (before || after) {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    return [...keys].filter(key => allowedChangeFields.has(key) && !sensitivePattern.test(key))
      .filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
      .map(key => ({ label: fieldLabels[key], before: text(before?.[key], key), after: text(after?.[key], key) }));
  }
  if (!allowedChangeFields.has(record.fieldName) || sensitivePattern.test(record.fieldName)) return [];
  return [{ label: fieldLabels[record.fieldName], before: text(record.originalValue, record.fieldName), after: text(record.newValue, record.fieldName) }];
}

function valueName(value: unknown): string | undefined {
  const record = object(value);
  return typeof record?.displayName === "string" ? record.displayName : typeof record?.employeeName === "string" ? record.employeeName : typeof record?.name === "string" ? record.name : undefined;
}

function resolveTarget(record: AuditRecord, resolvers: ActivityResolvers): string | undefined {
  const embedded = valueName(record.newValue) ?? valueName(record.originalValue);
  if (embedded) return embedded;
  if (record.entityType === "USER") return resolvers.users?.find(item => item.id === record.entityId)?.displayName;
  if (record.entityType === "EMPLOYEE") return resolvers.users?.find(item => item.employee?.id === record.entityId)?.displayName;
  if (record.entityType === "STATION") return resolvers.stations?.find(item => String(item.id) === record.entityId)?.name;
  if (record.entityType === "PRODUCT") return resolvers.products?.find(item => item.id === record.entityId)?.name;
  if (record.entityType === "ATTENDANCE") return resolvers.attendance?.find(item => item.id === record.entityId)?.employee?.user?.displayName;
  if (record.entityType === "INVENTORY") {
    const [stationId, productId] = record.entityId.split(":");
    const station = resolvers.stations?.find(item => String(item.id) === stationId)?.name;
    const product = resolvers.products?.find(item => item.id === productId)?.name;
    return station && product ? `${product} · ${station}` : station ?? product;
  }
  return undefined;
}

function description(record: AuditRecord): string {
  const key = `${record.entityType}:${record.fieldName}`;
  const descriptions: Record<string, string> = {
    "USER:created": "הוסיף משתמש חדש למערכת", "USER:profileAndRole": "עדכן את פרטי המשתמש",
    "USER:active": record.newValue === true ? "הפעיל מחדש משתמש" : "השבית משתמש",
    "USER:passwordReset": "איפס את הסיסמה של המשתמש",
    "EMPLOYEE:assignedStationId": "שינה את העמדה של העובד",
    "ATTENDANCE:record": "הוסיף רישום נוכחות", "ATTENDANCE:exceptionStatus": "עדכן חריגת נוכחות",
    "ATTENDANCE:shiftCorrection": "עדכן את שעות הנוכחות של", "ATTENDANCE:softDeleted": "מחק את רשומת הנוכחות של",
    "STATION:created": "הוסיף עמדה חדשה", "STATION:station": "עדכן את פרטי העמדה",
    "STATION:archivedAt": object(record.newValue)?.archivedAt ? "העביר עמדה לארכיון" : "שחזר עמדה מהארכיון",
    "STATION:permanentlyDeleted": "מחק עמדה לצמיתות", "STATION:duplicatedFrom": "שכפל עמדה",
    "PRODUCT:created": "הוסיף מוצר חדש", "PRODUCT:product": "עדכן את פרטי המוצר",
    "PRODUCT:stationProductDetails": "עדכן מוצר בעמדה", "INVENTORY:quantity": "ביצע התאמת מלאי",
    "INVENTORY:productAssignment": "עדכן שיוך מוצר לעמדה",
  };
  if (descriptions[key]) return descriptions[key];
  if (record.entityType === "ATTENDANCE" && allowedChangeFields.has(record.fieldName)) return "עדכן רישום נוכחות";
  return "ביצע פעולה במערכת";
}

export function mapAuditToActivity(record: AuditRecord, resolvers: ActivityResolvers = {}): ActivityItem {
  const [category, categoryLabel] = categoryMap[record.entityType] ?? ["SYSTEM", "מערכת"];
  const actor = record.adminUser?.displayName?.trim() || "מנהל המערכת";
  const initials = actor.split(/\s+/).map(part => part[0]).join("").slice(0, 2);
  return {
    id: record.id, actor, initials, description: description(record), target: resolveTarget(record, resolvers),
    category, categoryLabel, timestamp: new Date(record.serverTimestamp).toLocaleString("he-IL", { dateStyle: "long", timeStyle: "short" }),
    reason: record.reason && !sensitivePattern.test(record.reason) ? record.reason : undefined,
    changes: safeChanges(record), technical: { entityType: record.entityType, fieldName: record.fieldName },
  };
}

export function activityMatches(item: ActivityItem, query: string, category: ActivityCategory | "ALL") {
  const normalized = query.trim().toLocaleLowerCase("he");
  return (category === "ALL" || item.category === category) && (!normalized || `${item.actor} ${item.description} ${item.target ?? ""} ${item.categoryLabel}`.toLocaleLowerCase("he").includes(normalized));
}

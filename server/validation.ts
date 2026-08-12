import { z } from "zod";

export const loginDto = z.object({ email: z.string().email().max(254).transform(value => value.toLowerCase()), password: z.string().min(10).max(128) }).strict();
export const refreshDto = z.object({}).strict();
export const clockDto = z.object({
  action: z.enum(["CLOCK_IN", "CLOCK_OUT"]), stationId: z.number().int().positive().optional(),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  gpsAccuracy: z.number().nonnegative().max(10000).nullable().optional(), deviceInfo: z.string().max(300).nullable().optional(),
}).strict();
export const saleDto = z.object({ productId: z.string().uuid().or(z.string().regex(/^product-[a-z-]+$/)), quantity: z.number().int().min(1).max(100) }).strict();
export const attendanceCorrectionDto = z.object({
  reason: z.string().trim().min(5).max(500),
  changes: z.object({
    serverTimestamp: z.coerce.date().optional(), stationId: z.number().int().positive().optional(),
    action: z.enum(["CLOCK_IN", "CLOCK_OUT"]).optional(), exceptional: z.boolean().optional(), approvedByAdminId: z.string().uuid().nullable().optional(),
  }).strict(),
}).strict();
export const manualAttendanceDto = z.object({
  employeeId: z.string().min(1), stationId: z.number().int().positive(), action: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  timestamp: z.coerce.date(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  gpsAccuracy: z.number().nonnegative().nullable().optional(), distanceMeters: z.number().nonnegative(), reason: z.string().trim().min(5).max(500),
}).strict();
export const inventoryAdjustmentDto = z.object({
  stationId: z.number().int().positive(), productId: z.string().min(1), quantityDelta: z.number().int().min(-10000).max(10000),
  transactionType: z.enum(["INITIAL_COUNT", "STOCK_DELIVERY", "DAMAGED_REMOVAL", "MANUAL_ADJUSTMENT"]),
  reason: z.string().trim().min(5).max(500),
}).strict();
export const stationProductDto = z.object({
  productId: z.string().min(1),
  initialQuantity: z.number().int().min(0).max(100000),
  reason: z.string().trim().min(3).max(500).default("הוספת מוצר לעמדה"),
}).strict();
export const stationProductRemovalDto = z.object({
  reason: z.string().trim().min(3).max(500),
}).strict();
export const stationProductAdjustmentDto = z.object({
  quantityDelta: z.number().int().min(-10000).max(10000),
  transactionType: z.enum(["STOCK_DELIVERY", "DAMAGED_REMOVAL", "MANUAL_ADJUSTMENT"]),
  reason: z.string().trim().min(3).max(500),
}).strict();
export const stationProductDetailsDto = z.object({
  name: z.string().trim().min(2).max(120),
  price: z.number().positive().max(100000).multipleOf(0.01),
  quantity: z.number().int().min(0).max(100000),
  reason: z.string().trim().min(3).max(500).default("עריכת סוג זר בעמדה"),
}).strict();
export const createProductDto = z.object({
  name: z.string().trim().min(2).max(120),
  price: z.number().positive().max(100000).multipleOf(0.01),
  active: z.boolean().default(true),
}).strict();
export const updateProductDto = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  price: z.number().positive().max(100000).multipleOf(0.01).optional(),
  active: z.boolean().optional(),
  reason: z.string().trim().min(3).max(500),
}).strict().refine(value => value.name !== undefined || value.price !== undefined || value.active !== undefined, { message: "לא נבחר שינוי" });

export const attendanceApprovalDto = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
}).strict();

export const attendanceRejectionDto = z.object({
  reason: z.string().trim().min(3).max(500),
}).strict();

const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך הדוח אינו תקין");
export const payrollReportQueryDto = z.object({
  from: reportDate,
  to: reportDate,
  employeeId: z.string().min(1).max(100).optional(),
  stationId: z.coerce.number().int().positive().optional(),
}).strict().refine(value => value.to >= value.from, { message: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה", path: ["to"] }).refine(value => {
  const start = new Date(`${value.from}T00:00:00Z`).getTime();
  const end = new Date(`${value.to}T00:00:00Z`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end - start <= 366 * 24 * 60 * 60 * 1000;
}, { message: "ניתן להפיק דוח לתקופה של עד שנה", path: ["to"] });

const stationFields = {
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(250).default(""),
  locationDescription: z.string().trim().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  allowedRadiusMeters: z.number().int().min(10).max(5000).default(150),
  active: z.boolean().default(true),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  internalNotes: z.string().trim().max(2000).nullable().optional(),
};
export const createStationDto = z.object({
  ...stationFields,
  products: z.array(z.object({
    productId: z.string().min(1),
    initialQuantity: z.number().int().min(0).max(100000),
  }).strict()).max(100).default([]),
}).strict().refine(value => new Set(value.products.map(item => item.productId)).size === value.products.length, {
  message: "לא ניתן להוסיף אותו מוצר יותר מפעם אחת", path: ["products"],
}).refine(value => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
  message: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה", path: ["endDate"],
});
export const updateStationDto = z.object({
  ...Object.fromEntries(Object.entries(stationFields).map(([key, schema]) => [key, schema.optional()])),
  reason: z.string().trim().min(3).max(500),
}).strict();
export const stationStatusDto = z.object({ active: z.boolean(), reason: z.string().trim().min(3).max(500) }).strict();
export const stationArchiveDto = z.object({
  reason: z.string().trim().min(3).max(500).default("העברת עמדה לארכיון"),
}).strict();
export const stationRestoreDto = z.object({
  reason: z.string().trim().min(3).max(500).default("שחזור עמדה מהארכיון"),
  active: z.boolean().default(false),
}).strict();
export const stationPermanentDeleteDto = z.object({
  confirmationName: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(3).max(500).default("מחיקה לצמיתות מארכיון העמדות"),
}).strict();
export const duplicateStationDto = z.object({
  name: z.string().trim().min(2).max(120),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  copyInventory: z.boolean().default(true),
}).strict();

export const employeeStationAssignmentDto = z.object({
  stationId: z.number().int().positive().nullable(),
  reason: z.string().trim().min(3).max(500).default("שינוי שיוך עובד לעמדה"),
}).strict();

const managedUserFields = {
  displayName: z.string().trim().min(2, "יש להזין שם מלא").max(100),
  email: z.string().trim().email("כתובת הדוא״ל אינה תקינה").max(254).transform(value => value.toLowerCase()),
  systemRole: z.enum(["ADMIN", "EMPLOYEE"]),
  jobPosition: z.string().trim().min(2, "יש להזין תפקיד בעסק").max(100).optional(),
  hourlyRate: z.number().nonnegative().max(10000).multipleOf(0.01).optional(),
  assignedStationId: z.number().int().positive().nullable().optional(),
};

export const createManagedUserDto = z.object({
  ...managedUserFields,
  password: z.string().min(10, "הסיסמה חייבת להכיל לפחות 10 תווים").max(128),
}).strict().superRefine((value, context) => {
  if (value.systemRole === "EMPLOYEE" && !value.jobPosition) {
    context.addIssue({ code: "custom", path: ["jobPosition"], message: "יש להזין תפקיד בעסק לעובד" });
  }
});

export const updateManagedUserDto = z.object({
  displayName: managedUserFields.displayName.optional(),
  email: managedUserFields.email.optional(),
  systemRole: managedUserFields.systemRole.optional(),
  jobPosition: managedUserFields.jobPosition,
  hourlyRate: managedUserFields.hourlyRate,
  assignedStationId: managedUserFields.assignedStationId,
  reason: z.string().trim().min(3).max(500).default("עדכון פרטי משתמש"),
}).strict().refine(value => Object.keys(value).some(key => key !== "reason"), {
  message: "לא נבחר שינוי לעדכון",
}).superRefine((value, context) => {
  if (value.systemRole === "EMPLOYEE" && value.jobPosition !== undefined && !value.jobPosition) {
    context.addIssue({ code: "custom", path: ["jobPosition"], message: "יש להזין תפקיד בעסק לעובד" });
  }
});

export const managedUserStatusDto = z.object({
  active: z.boolean(),
  reason: z.string().trim().min(3).max(500).default("שינוי מצב גישה למערכת"),
}).strict();

export const managedUserPasswordDto = z.object({
  password: z.string().min(10, "הסיסמה חייבת להכיל לפחות 10 תווים").max(128, "הסיסמה ארוכה מדי"),
}).strict();

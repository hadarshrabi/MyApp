import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ZodError, type ZodType } from "zod";
import { PostgresRepository, ConflictError, ForbiddenError } from "./postgres-repository";
import { attendanceApprovalDto, attendanceCorrectionDto, attendanceRejectionDto, clockDto, createManagedUserDto, createProductDto, createStationDto, duplicateStationDto, employeeStationAssignmentDto, inventoryAdjustmentDto, loginDto, managedUserPasswordDto, managedUserStatusDto, manualAttendanceDto, payrollReportQueryDto, saleDto, stationArchiveDto, stationPermanentDeleteDto, stationProductAdjustmentDto, stationProductDetailsDto, stationProductDto, stationProductRemovalDto, stationRestoreDto, stationStatusDto, updateManagedUserDto, updateProductDto, updateStationDto } from "./validation";
import { createAccessToken, hashPassword, hashRefreshToken, newRefreshToken, newTokenFamily, refreshCookie, refreshExpiry, verifyPassword } from "./auth";
import { requireActiveUser, requireAdmin, requireAuth } from "./middleware/auth";

export function createApp(repository = new PostgresRepository()) {
  const app = express();
  const allowedOrigin = process.env.APP_ORIGIN;
  if (!allowedOrigin) throw new Error("APP_ORIGIN is required");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org"], connectSrc: ["'self'", "https://*.tile.openstreetmap.org", "https://nominatim.openstreetmap.org"],
        objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  }));
  app.use(cors({ origin: allowedOrigin, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["Authorization", "Content-Type"] }));
  app.use(express.json({ limit: "32kb", strict: true }));
  app.use(cookieParser());
  app.use((request, response, next) => { response.locals.requestId = randomUUID(); response.setHeader("x-request-id", response.locals.requestId); next(); });

  app.get("/api/health/live", (_request, response) => response.json({ status: "ok" }));

  const readinessHandler = asyncRoute(async (_request, response) => {
    try {
      await repository.healthCheck();
      return response.json({ status: "ok" });
    } catch {
      return response.status(503).json({ status: "unavailable" });
    }
  });
  app.get("/api/health/ready", readinessHandler);
  app.get("/api/health", readinessHandler);

  app.post("/api/auth/login", validate(loginDto), authRateLimit(repository), asyncRoute(async (request, response) => {
    const user = await repository.findUserByEmail(request.body.email);
    if (!user?.passwordHash || !(await verifyPassword(request.body.password, user.passwordHash))) return response.status(401).json({ error: "פרטי ההתחברות שגויים" });
    const authUser = safeAuthUser(user);
    const accessToken = await createAccessToken(authUser);
    const rawRefresh = newRefreshToken();
    await repository.createRefreshToken({
      userId: user.id, tokenHash: hashRefreshToken(rawRefresh), familyId: newTokenFamily(), expiresAt: refreshExpiry(),
      userAgent: request.get("user-agent")?.slice(0, 300), ipAddress: request.ip,
    });
    response.cookie(refreshCookie.name, rawRefresh, refreshCookie.options);
    return response.json({ accessToken, expiresIn: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900), user: publicUser(user) });
  }));

  app.post("/api/auth/refresh", authRateLimit(repository), asyncRoute(async (request, response) => {
    const rawRefresh = request.cookies[refreshCookie.name];
    if (typeof rawRefresh !== "string" || rawRefresh.length < 40) return response.status(401).json({ error: "אסימון הרענון חסר" });
    const stored = await repository.findRefreshToken(hashRefreshToken(rawRefresh));
    if (!stored || !stored.user.active || stored.expiresAt <= new Date()) return response.status(401).json({ error: "אסימון הרענון אינו תקין או שפג תוקפו" });
    if (stored.revokedAt) { await repository.revokeTokenFamily(stored.familyId); return response.status(401).json({ error: "זוהה שימוש חוזר באסימון שבוטל" }); }
    const nextRaw = newRefreshToken();
    await repository.rotateRefreshToken(stored.id, { tokenHash: hashRefreshToken(nextRaw), expiresAt: refreshExpiry(), userAgent: request.get("user-agent")?.slice(0, 300), ipAddress: request.ip });
    response.cookie(refreshCookie.name, nextRaw, refreshCookie.options);
    return response.json({ accessToken: await createAccessToken(safeAuthUser(stored.user)), expiresIn: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900) });
  }));

  app.post("/api/auth/logout", asyncRoute(async (request, response) => {
    const rawRefresh = request.cookies[refreshCookie.name];
    if (typeof rawRefresh === "string") {
      const stored = await repository.findRefreshToken(hashRefreshToken(rawRefresh));
      if (stored) await repository.revokeTokenFamily(stored.familyId);
    }
    response.clearCookie(refreshCookie.name, { ...refreshCookie.options, maxAge: 0 });
    return response.status(204).send();
  }));

  app.use("/api", requireAuth);
  app.use("/api", requireActiveUser(repository));
  app.get("/api/me", asyncRoute(async (request, response) => {
    const user = await repository.findUserById(request.auth!.userId);
    return user ? response.json({ user: publicUser(user) }) : response.status(401).json({ error: "המשתמש אינו פעיל" });
  }));
  app.get("/api/geocode", asyncRoute(async (request, response) => {
    const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
    if (query.length < 3 || query.length > 120) return response.status(400).json({ error: "יש להזין בין 3 ל־120 תווים לחיפוש" });
    const rate = await repository.consumeRateLimit(`geocode:${request.auth!.userId}`, 30, 10 * 60 * 1000);
    if (!rate.allowed) return response.status(429).json({ error: "בוצעו יותר מדי חיפושים. יש לנסות שוב בעוד מספר דקות" });
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2"); url.searchParams.set("limit", "10"); url.searchParams.set("countrycodes", "il,ps"); url.searchParams.set("accept-language", "he"); url.searchParams.set("addressdetails", "1"); url.searchParams.set("q", normalizeGeocodeQuery(query));
    try {
      const upstream = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json", "User-Agent": "LinoyDesigns-StationManager/1.0", Referer: process.env.APP_ORIGIN! } });
      if (!upstream.ok) return response.status(503).json({ error: "שירות חיפוש המקומות אינו זמין כרגע. אפשר לבחור נקודה ישירות במפה" });
      const payload = await upstream.json() as Array<{ lat: string; lon: string; display_name: string }>;
      return response.json({ results: payload.map(item => ({ latitude: Number(item.lat), longitude: Number(item.lon), label: item.display_name })).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) });
    } catch {
      return response.status(503).json({ error: "החיפוש התעכב יותר מדי. אפשר לבחור נקודה ישירות במפה" });
    }
  }));
  app.get("/api/attendance/me", asyncRoute(async (request, response) => {
    if (!request.auth!.employeeId) return response.json({ records: [] });
    return response.json({ records: await repository.getAttendanceForEmployee(request.auth!.employeeId) });
  }));
  app.get("/api/attendance", requireAdmin, asyncRoute(async (_request, response) => response.json({ records: await repository.getAllAttendance() })));
  app.get("/api/stations", asyncRoute(async (request, response) => {
    const assignment = request.auth!.role === "EMPLOYEE" && request.auth!.employeeId
      ? await repository.getEmployeeAssignment(request.auth!.employeeId)
      : null;
    const stationId = request.auth!.role === "EMPLOYEE" ? assignment?.assignedStationId ?? null : null;
    return response.json({ stations: await repository.getStationsForUser(request.auth!.role, stationId) });
  }));
  app.get("/api/admin/bootstrap", requireAdmin, asyncRoute(async (_request, response) => response.json(await repository.getAdminBootstrap())));
  app.post("/api/admin/users", requireAdmin, validate(createManagedUserDto), asyncRoute(async (request, response) => {
    const { password, ...input } = request.body;
    const user = await repository.createManagedUser({ ...input, passwordHash: await hashPassword(password) }, request.auth!.userId);
    return response.status(201).json({ user });
  }));
  app.patch("/api/admin/users/:id", requireAdmin, validate(updateManagedUserDto), asyncRoute(async (request, response) => {
    const user = await repository.updateManagedUser(String(request.params.id), request.body, request.auth!.userId);
    return user ? response.json({ user }) : response.status(404).json({ error: "המשתמש לא נמצא" });
  }));
  app.post("/api/admin/users/:id/status", requireAdmin, validate(managedUserStatusDto), asyncRoute(async (request, response) => {
    const user = await repository.setManagedUserStatus(String(request.params.id), request.body.active, request.auth!.userId, request.body.reason);
    return user ? response.json({ user }) : response.status(404).json({ error: "המשתמש לא נמצא" });
  }));
  app.post("/api/admin/users/:id/password", requireAdmin, validate(managedUserPasswordDto), asyncRoute(async (request, response) => {
    const targetUserId = String(request.params.id);
    if (targetUserId === request.auth!.userId) return response.status(403).json({ error: "לא ניתן לאפס את הסיסמה של המשתמש המחובר ממסך הניהול" });
    const updated = await repository.resetManagedUserPassword(targetUserId, await hashPassword(request.body.password), request.auth!.userId);
    return updated ? response.json({ success: true }) : response.status(404).json({ error: "המשתמש לא נמצא" });
  }));
  app.patch("/api/admin/employees/:id/station", requireAdmin, validate(employeeStationAssignmentDto), asyncRoute(async (request, response) => {
    const employee = await repository.assignEmployeeStation(String(request.params.id), request.body.stationId, request.auth!.userId, request.body.reason);
    return employee ? response.json({ employee }) : response.status(404).json({ error: "העובד לא נמצא" });
  }));
  app.get("/api/admin/reports/payroll", requireAdmin, asyncRoute(async (request, response) => {
    const filters = payrollReportQueryDto.parse(request.query);
    return response.json(await repository.getPayrollReport(filters));
  }));
  app.post("/api/admin/products", requireAdmin, validate(createProductDto), asyncRoute(async (request, response) =>
    response.status(201).json({ product: await repository.createProduct(request.body, request.auth!.userId) })));
  app.patch("/api/admin/products/:id", requireAdmin, validate(updateProductDto), asyncRoute(async (request, response) => {
    const product = await repository.updateProduct(String(request.params.id), request.body, request.auth!.userId);
    return product ? response.json({ product }) : response.status(404).json({ error: "המוצר לא נמצא" });
  }));
  app.post("/api/admin/stations", requireAdmin, validate(createStationDto), asyncRoute(async (request, response) =>
    response.status(201).json({ station: await repository.createStation(request.body, request.auth!.userId) })));
  app.patch("/api/admin/stations/:id", requireAdmin, validate(updateStationDto), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    const { reason, ...changes } = request.body;
    const station = await repository.updateStation(id, changes, request.auth!.userId, reason);
    return station ? response.json({ station }) : response.status(404).json({ error: "העמדה לא נמצאה" });
  }));
  app.post("/api/admin/stations/:id/status", requireAdmin, validate(stationStatusDto), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    const station = await repository.updateStation(id, { active: request.body.active }, request.auth!.userId, request.body.reason);
    return station ? response.json({ station }) : response.status(404).json({ error: "העמדה לא נמצאה" });
  }));
  app.post("/api/admin/stations/:id/archive", requireAdmin, validate(stationArchiveDto), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    const station = await repository.archiveStation(id, request.auth!.userId, request.body.reason);
    return station ? response.json({ station }) : response.status(404).json({ error: "העמדה לא נמצאה" });
  }));
  app.post("/api/admin/stations/:id/restore", requireAdmin, validate(stationRestoreDto), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    const station = await repository.restoreStation(id, request.auth!.userId, request.body.reason, request.body.active);
    return station ? response.json({ station }) : response.status(404).json({ error: "העמדה לא נמצאה" });
  }));
  app.delete("/api/admin/stations/:id", requireAdmin, validate(stationPermanentDeleteDto), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    const station = await repository.permanentlyDeleteStation(id, request.body.confirmationName, request.auth!.userId, request.body.reason);
    return station ? response.json({ station }) : response.status(404).json({ error: "העמדה לא נמצאה" });
  }));
  app.post("/api/admin/stations/:id/duplicate", requireAdmin, validate(duplicateStationDto), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    const station = await repository.duplicateStation(id, request.body, request.auth!.userId);
    return station ? response.status(201).json({ station }) : response.status(404).json({ error: "העמדה לא נמצאה" });
  }));
  app.post("/api/admin/stations/:stationId/products", requireAdmin, validate(stationProductDto), asyncRoute(async (request, response) => {
    const stationId = Number(request.params.stationId);
    if (!Number.isInteger(stationId)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    return response.status(201).json({ inventory: await repository.addStationProduct(stationId, request.body, request.auth!.userId) });
  }));
  app.delete("/api/admin/stations/:stationId/products/:productId", requireAdmin, validate(stationProductRemovalDto), asyncRoute(async (request, response) => {
    const stationId = Number(request.params.stationId);
    if (!Number.isInteger(stationId)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    await repository.removeStationProduct(stationId, String(request.params.productId), request.body.reason, request.auth!.userId);
    return response.status(204).send();
  }));
  app.patch("/api/admin/stations/:stationId/products/:productId", requireAdmin, validate(stationProductAdjustmentDto), asyncRoute(async (request, response) => {
    const stationId = Number(request.params.stationId);
    if (!Number.isInteger(stationId)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    return response.json({ transaction: await repository.adjustInventory({ stationId, productId: String(request.params.productId), ...request.body }, request.auth!.userId) });
  }));
  app.patch("/api/admin/stations/:stationId/products/:productId/details", requireAdmin, validate(stationProductDetailsDto), asyncRoute(async (request, response) => {
    const stationId = Number(request.params.stationId);
    if (!Number.isInteger(stationId)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    return response.json(await repository.updateStationProductDetails(stationId, String(request.params.productId), request.body, request.auth!.userId));
  }));
  app.get("/api/admin/attendance/exceptions", requireAdmin, asyncRoute(async (request, response) => {
    const status = typeof request.query.status === "string" ? request.query.status : undefined;
    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) return response.status(400).json({ error: "סטטוס החריגה אינו תקין" });
    return response.json({ records: await repository.getAttendanceExceptions(status as "PENDING" | "APPROVED" | "REJECTED" | undefined) });
  }));
  app.post("/api/admin/attendance/:id/approve", requireAdmin, validate(attendanceApprovalDto), asyncRoute(async (request, response) => {
    const record = await repository.reviewAttendanceException(String(request.params.id), "APPROVED", request.auth!.userId, request.body.reason);
    return record ? response.json({ record }) : response.status(404).json({ error: "חריגת הנוכחות לא נמצאה" });
  }));
  app.post("/api/admin/attendance/:id/reject", requireAdmin, validate(attendanceRejectionDto), asyncRoute(async (request, response) => {
    const record = await repository.reviewAttendanceException(String(request.params.id), "REJECTED", request.auth!.userId, request.body.reason);
    return record ? response.json({ record }) : response.status(404).json({ error: "חריגת הנוכחות לא נמצאה" });
  }));
  app.get("/api/employee/home", asyncRoute(async (request, response) => {
    if (!request.auth!.employeeId) return response.status(403).json({ error: "אין שיוך עובד" });
    const assignment = await repository.getEmployeeAssignment(request.auth!.employeeId);
    if (!assignment?.assignedStationId) return response.status(403).json({ error: "העובד אינו משויך לעמדה פעילה" });
    const home = await repository.getEmployeeHome(request.auth!.employeeId, assignment.assignedStationId);
    return home ? response.json(home) : response.status(404).json({ error: "העמדה לא נמצאה" });
  }));
  app.get("/api/stations/:stationId/inventory", asyncRoute(async (request, response) => {
    const stationId = Number(request.params.stationId);
    if (!Number.isInteger(stationId)) return response.status(400).json({ error: "מזהה עמדה אינו תקין" });
    if (request.auth!.role !== "ADMIN") {
      const assignment = request.auth!.employeeId ? await repository.getEmployeeAssignment(request.auth!.employeeId) : null;
      if (assignment?.assignedStationId !== stationId) return response.status(403).json({ error: "אין הרשאה לצפות במלאי עמדה זו" });
    }
    return response.json({ inventory: await repository.getInventory(stationId) });
  }));

  app.post("/api/attendance/clock", validate(clockDto), asyncRoute(async (request, response) => {
    const auth = request.auth!;
    if (!auth.employeeId) return response.status(403).json({ error: "אין שיוך עובד" });
    const assignment = await repository.getEmployeeAssignment(auth.employeeId);
    const assignedStationId = assignment?.assignedStationId;
    if (!assignedStationId) return response.status(403).json({ error: "העובד אינו משויך לעמדה פעילה" });
    if (request.body.stationId && request.body.stationId !== assignedStationId) return response.status(403).json({ error: "אין הרשאה לדווח בעמדה אחרת" });
    const station = await repository.getStation(assignedStationId);
    if (!station) return response.status(404).json({ error: "העמדה לא נמצאה" });
    const distanceMeters = calculateDistance(request.body, station);
    const record = await repository.createAttendance({
      employeeId: auth.employeeId, stationId: assignedStationId, action: request.body.action,
      latitude: request.body.latitude, longitude: request.body.longitude, gpsAccuracy: request.body.gpsAccuracy ?? null,
      distanceMeters, deviceInfo: request.body.deviceInfo ?? null, exceptional: distanceMeters > station.allowedRadiusMeters,
    });
    return response.status(201).json({ record });
  }));
  app.post("/api/attendance/manual", requireAdmin, validate(manualAttendanceDto), asyncRoute(async (request, response) => response.status(201).json({ record: await repository.createManualAttendance(request.body, request.auth!.userId) })));
  app.patch("/api/attendance/:id", requireAdmin, validate(attendanceCorrectionDto), asyncRoute(async (request, response) => {
    const record = await repository.correctAttendance(String(request.params.id), request.body.changes, request.auth!.userId, request.body.reason);
    return record ? response.json({ record }) : response.status(404).json({ error: "רשומת הנוכחות לא נמצאה" });
  }));
  app.post("/api/sales", validate(saleDto), asyncRoute(async (request, response) => {
    const auth = request.auth!;
    if (!auth.employeeId) return response.status(403).json({ error: "אין הרשאה לדווח מכירה" });
    const assignment = await repository.getEmployeeAssignment(auth.employeeId);
    if (!assignment?.assignedStationId) return response.status(403).json({ error: "העובד אינו משויך לעמדה פעילה" });
    return response.status(201).json({ sale: await repository.createSaleAtomic({ ...request.body, employeeId: auth.employeeId, stationId: assignment.assignedStationId }) });
  }));
  app.post("/api/inventory/adjust", requireAdmin, validate(inventoryAdjustmentDto), asyncRoute(async (request, response) => response.status(201).json({ transaction: await repository.adjustInventory(request.body, request.auth!.userId) })));
  app.post("/api/admin/inventory/adjust", requireAdmin, validate(inventoryAdjustmentDto), asyncRoute(async (request, response) => response.status(201).json({ transaction: await repository.adjustInventory(request.body, request.auth!.userId) })));

  app.use("/api", (_request, response) => response.status(404).json({ error: "נתיב ה־API לא נמצא" }));
  if (process.env.NODE_ENV === "production") {
    const clientDirectory = path.resolve(process.cwd(), "dist/client");
    app.use(express.static(clientDirectory, { index: false, maxAge: "1h" }));
    app.get("/{*path}", (_request, response) => response.sendFile(path.join(clientDirectory, "index.html")));
  }
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const requestId = response.locals.requestId;
    if (error instanceof ZodError) return response.status(400).json({ error: "נתוני הבקשה אינם תקינים", requestId, details: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
    if (error instanceof ForbiddenError) return response.status(403).json({ error: error.message, requestId });
    if (error instanceof ConflictError) return response.status(409).json({ error: error.message, requestId });
    console.error("API error", { requestId, name: error instanceof Error ? error.name : "UnknownError" });
    return response.status(500).json({ error: "אירעה שגיאה פנימית", requestId });
  });
  return app;
}

function validate(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction) => { try { request.body = schema.parse(request.body); next(); } catch (error) { next(error); } };
}
function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>) {
  return (request: Request, response: Response, next: NextFunction) => { void handler(request, response, next).catch(next); };
}
function authRateLimit(repository: PostgresRepository) {
  return asyncRoute(async (request, response, next) => {
    const email = typeof request.body?.email === "string" ? request.body.email.toLowerCase() : "refresh";
    const result = await repository.consumeRateLimit(`auth:${request.ip}:${email}`, 8, 15 * 60 * 1000);
    response.setHeader("x-ratelimit-remaining", result.remaining);
    if (!result.allowed) return response.status(429).json({ error: "יותר מדי ניסיונות. יש לנסות שוב מאוחר יותר" });
    next();
  });
}
function safeAuthUser(user: any) { return { userId: user.id, role: user.systemRole, employeeId: user.employee?.id ?? null, stationId: user.employee?.assignedStationId ?? null }; }
function publicUser(user: any) { return { id: user.id, email: user.email, displayName: user.displayName, systemRole: user.systemRole, employee: user.employee ? { id: user.employee.id, jobPosition: user.employee.jobPosition, assignedStationId: user.employee.assignedStationId } : null }; }
function calculateDistance(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radius = 6371e3, φ1 = from.latitude * Math.PI / 180, φ2 = to.latitude * Math.PI / 180;
  const dφ = (to.latitude - from.latitude) * Math.PI / 180, dλ = (to.longitude - from.longitude) * Math.PI / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function normalizeGeocodeQuery(query: string) {
  const parts = query.replace(/[,،]+/g, " ").trim().split(/\s+/);
  const last = parts.at(-1);
  if (parts.length >= 3 && last && /^\d+[א-תA-Za-z]?$/.test(last)) {
    const city = parts[0];
    const street = parts.slice(1, -1).join(" ");
    return `${last} ${street}, ${city}`;
  }
  return query;
}

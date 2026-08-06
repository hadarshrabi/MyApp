import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile?.(".env");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const testDatabaseUrl = new URL(process.env.DATABASE_URL);
if (testDatabaseUrl.pathname.endsWith("_test")) throw new Error("DATABASE_URL must point to production before deriving the isolated test database");
testDatabaseUrl.pathname = `${testDatabaseUrl.pathname}_test`;
process.env.DATABASE_URL = testDatabaseUrl.toString();
process.env.JWT_ACCESS_SECRET = "local-test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_ISSUER = "linoy-designs-api";
process.env.JWT_AUDIENCE = "linoy-designs-app";
process.env.ACCESS_TOKEN_TTL_SECONDS = "900";
process.env.REFRESH_TOKEN_TTL_DAYS = "30";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.NODE_ENV = "test";

let app: import("express").Express;
let prisma: import("@prisma/client").PrismaClient;
let adminToken = "";
let employeeToken = "";
const adminPassword = "Test-Admin-Password-2026!";
const employeePassword = "Test-Employee-Password-2026!";

before(async () => {
  const modules = await Promise.all([import("../server/app"), import("../server/prisma")]);
  app = modules[0].createApp();
  prisma = modules[1].prisma;
  await prisma.user.update({ where: { id: "user-admin" }, data: { passwordHash: await bcrypt.hash(adminPassword, 12) } });
  await prisma.user.update({ where: { id: "user-employee-1" }, data: { passwordHash: await bcrypt.hash(employeePassword, 12) } });
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.inventoryTransaction.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.attendanceRecord.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.employee.deleteMany({ where: { user: { email: { startsWith: "user-test-" } } } }),
    prisma.user.deleteMany({ where: { email: { startsWith: "user-test-" } } }),
    prisma.employee.update({ where: { id: "emp-1" }, data: { assignedStationId: 1 } }),
    prisma.station.deleteMany({ where: { name: { startsWith: "בדיקת עמדה" } } }),
    prisma.product.deleteMany({ where: { id: { in: ["product-test-inactive", "product-test-station-details"] } } }),
    prisma.rateLimitBucket.deleteMany(),
    prisma.stationInventory.update({ where: { stationId_productId: { stationId: 1, productId: "product-white-roses" } }, data: { quantity: 20, version: 0, active: true } }),
  ]);
  adminToken = (await request(app).post("/api/auth/login").send({ email: "owner@linoy-designs.example", password: adminPassword })).body.accessToken;
  employeeToken = (await request(app).post("/api/auth/login").send({ email: "maya@linoy-designs.example", password: employeePassword })).body.accessToken;
});

after(async () => {
  await prisma.inventoryTransaction.deleteMany({ where: { station: { name: { startsWith: "בדיקת עמדה" } } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { contains: "product-test-station-details" } } });
  await prisma.attendanceRecord.deleteMany({ where: { station: { name: { startsWith: "בדיקת עמדה" } } } });
  await prisma.station.deleteMany({ where: { name: { startsWith: "בדיקת עמדה" } } });
  if (process.env.SEED_ADMIN_PASSWORD && process.env.SEED_EMPLOYEE_PASSWORD) {
    await prisma.user.update({ where: { id: "user-admin" }, data: { passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12) } });
    await prisma.user.update({ where: { id: "user-employee-1" }, data: { passwordHash: await bcrypt.hash(process.env.SEED_EMPLOYEE_PASSWORD, 12) } });
  }
  await prisma.$disconnect();
});

test("EMPLOYEE מקבל 403 בכל נתיבי המנהל", async () => {
  const calls = [
    request(app).get("/api/attendance"),
    request(app).post("/api/attendance/manual").send({}),
    request(app).patch("/api/attendance/other-record").send({}),
    request(app).post("/api/inventory/adjust").send({}),
    request(app).post("/api/admin/inventory/adjust").send({}),
    request(app).post("/api/admin/stations/1/products").send({}),
    request(app).delete("/api/admin/stations/1/products/product-white-roses").send({ reason: "ניסיון אסור" }),
    request(app).post("/api/admin/stations/1/archive").send({}),
    request(app).post("/api/admin/stations/1/restore").send({}),
    request(app).delete("/api/admin/stations/1").send({ confirmationName: "עמדת פיתוח" }),
    request(app).patch("/api/admin/employees/emp-1/station").send({ stationId: 1, reason: "ניסיון אסור" }),
    request(app).post("/api/admin/users").send({}),
    request(app).patch("/api/admin/users/user-admin").send({ displayName: "ניסיון אסור" }),
    request(app).post("/api/admin/users/user-admin/status").send({ active: false }),
    request(app).get("/api/admin/reports/payroll?from=2026-08-01&to=2026-08-31"),
  ];
  for (const call of calls) assert.equal((await call.set("Authorization", `Bearer ${employeeToken}`)).status, 403);
});

test("מנהל יוצר עובד אמיתי עם סיסמה מוצפנת ורישום ביקורת", async () => {
  const password = "User-Test-Password-2026!";
  const response = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      displayName: "עובדת בדיקה",
      email: "user-test-employee@example.com",
      password,
      systemRole: "EMPLOYEE",
      jobPosition: "מוכרת",
      hourlyRate: 45.5,
      assignedStationId: 1,
    });
  assert.equal(response.status, 201);
  assert.equal(response.body.user.systemRole, "EMPLOYEE");
  assert.equal(response.body.user.employee.assignedStationId, 1);
  assert.equal(response.body.user.passwordHash, undefined);

  const stored = await prisma.user.findUniqueOrThrow({ where: { email: "user-test-employee@example.com" }, include: { employee: true } });
  assert.notEqual(stored.passwordHash, password);
  assert.equal(await bcrypt.compare(password, stored.passwordHash!), true);
  assert.equal(stored.employee?.hourlyRateCents, 4550);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "USER", entityId: stored.id, fieldName: "created" } }), 1);

  const login = await request(app).post("/api/auth/login").send({ email: stored.email, password });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.systemRole, "EMPLOYEE");
});

test("השבתת משתמש מבטלת גישה ואסימוני רענון בלי למחוק היסטוריה", async () => {
  const password = "User-Test-Disable-2026!";
  const created = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ displayName: "עובד להשבתה", email: "user-test-disabled@example.com", password, systemRole: "EMPLOYEE", jobPosition: "מוכר" });
  assert.equal(created.status, 201);
  const userId = created.body.user.id;
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email: "user-test-disabled@example.com", password });
  assert.equal(login.status, 200);

  const disabled = await request(app)
    .post(`/api/admin/users/${userId}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ active: false, reason: "בדיקת השבתת משתמש" });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.user.active, false);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).active, false);
  assert.equal((await request(app).get("/api/stations").set("Authorization", `Bearer ${login.body.accessToken}`)).status, 401);
  assert.equal((await agent.post("/api/auth/refresh").send({})).status, 401);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "USER", entityId: userId, fieldName: "active" } }), 1);
});

test("לא ניתן להשבית את המשתמש המחובר או את המנהל האחרון", async () => {
  const selfDisable = await request(app)
    .post("/api/admin/users/user-admin/status")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ active: false, reason: "ניסיון השבתה עצמית" });
  assert.equal(selfDisable.status, 403);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: "user-admin" } })).active, true);

  const selfDemote = await request(app)
    .patch("/api/admin/users/user-admin")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ systemRole: "EMPLOYEE", jobPosition: "מוכר", reason: "ניסיון שינוי הרשאה עצמית" });
  assert.equal(selfDemote.status, 403);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: "user-admin" } })).systemRole, "ADMIN");
});

test("רק מנהל משייך עובד לעמדה והשינוי נאכף מיד לפי PostgreSQL", async () => {
  const station = await prisma.station.create({ data: {
    name: "בדיקת עמדה לשיוך", address: "", locationDescription: "עמדת בדיקה",
    latitude: 32.11, longitude: 34.81, active: true,
  } });

  const response = await request(app)
    .patch("/api/admin/employees/emp-1/station")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ stationId: station.id, reason: "שינוי שיוך לצורך בדיקה" });
  assert.equal(response.status, 200);
  assert.equal(response.body.employee.assignedStationId, station.id);
  assert.equal((await prisma.auditLog.count({ where: { entityType: "EMPLOYEE", entityId: "emp-1", fieldName: "assignedStationId" } })), 1);

  // The employee token was issued while station 1 was assigned. Runtime access
  // must still follow the current database assignment instead of that stale claim.
  const home = await request(app).get("/api/employee/home").set("Authorization", `Bearer ${employeeToken}`);
  assert.equal(home.status, 200);
  assert.equal(home.body.station.id, station.id);
});

test("לא ניתן לשנות שיוך עובד באמצע משמרת", async () => {
  const station = await prisma.station.create({ data: {
    name: "בדיקת עמדה בזמן משמרת", address: "", latitude: 32.12, longitude: 34.82, active: true,
  } });
  await prisma.attendanceRecord.create({ data: {
    employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", latitude: 32.0743, longitude: 34.7925, distanceMeters: 0,
  } });
  const response = await request(app)
    .patch("/api/admin/employees/emp-1/station")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ stationId: station.id, reason: "ניסיון שינוי באמצע משמרת" });
  assert.equal(response.status, 409);
  assert.equal((await prisma.employee.findUniqueOrThrow({ where: { id: "emp-1" } })).assignedStationId, 1);
});

test("דוח השכר מקשר שעות, עמדה ומכירות למשמרת ומוגן למנהל", async () => {
  const clockIn = new Date("2026-08-01T07:00:00.000Z");
  const clockOut = new Date("2026-08-01T15:00:00.000Z");
  await prisma.attendanceRecord.createMany({ data: [
    { employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", serverTimestamp: clockIn, latitude: 32.0743, longitude: 34.7925, distanceMeters: 0 },
    { employeeId: "emp-1", stationId: 1, action: "CLOCK_OUT", serverTimestamp: clockOut, latitude: 32.0743, longitude: 34.7925, distanceMeters: 0 },
  ] });
  await prisma.sale.create({ data: {
    employeeId: "emp-1", stationId: 1, productId: "product-white-roses", quantity: 2,
    unitPriceCents: 18900, totalAmountCents: 37800, serverTimestamp: new Date("2026-08-01T10:00:00.000Z"),
    previousInventoryQuantity: 20, newInventoryQuantity: 18,
  } });
  const url = "/api/admin/reports/payroll?from=2026-08-01&to=2026-08-01";
  assert.equal((await request(app).get(url).set("Authorization", `Bearer ${employeeToken}`)).status, 403);
  const response = await request(app).get(url).set("Authorization", `Bearer ${adminToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.summary.totalMinutes, 480);
  assert.equal(response.body.summary.workDays, 1);
  assert.equal(response.body.summary.salesQuantity, 2);
  assert.equal(response.body.summary.salesAmountCents, 37800);
  assert.equal(response.body.shifts.length, 1);
  assert.equal(response.body.shifts[0].station.id, 1);
  assert.equal(response.body.shifts[0].products[0].productId, "product-white-roses");
  assert.equal(response.body.shifts[0].products[0].quantity, 2);
});

test("עובד אינו יכול לשנות רשומת נוכחות של עובד אחר", async () => {
  const record = await prisma.attendanceRecord.create({ data: { employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", latitude: 32.0743, longitude: 34.7925, distanceMeters: 0 } });
  const response = await request(app).patch(`/api/attendance/${record.id}`).set("Authorization", `Bearer ${employeeToken}`).send({ reason: "ניסיון שינוי אסור", changes: { serverTimestamp: new Date().toISOString() } });
  assert.equal(response.status, 403);
  assert.equal((await prisma.auditLog.count()), 0);
});

test("שדות סמכותיים מהלקוח נדחים בולידציית DTO", async () => {
  const response = await request(app).post("/api/attendance/clock").set("Authorization", `Bearer ${employeeToken}`).send({
    action: "CLOCK_IN", latitude: 32.0743, longitude: 34.7925, employeeId: "emp-admin", role: "ADMIN", serverTimestamp: "1999-01-01",
  });
  assert.equal(response.status, 400);
});

test("כניסה כפולה נדחית והזמן נקבע בשרת", async () => {
  const payload = { action: "CLOCK_IN", latitude: 32.0743, longitude: 34.7925, gpsAccuracy: 5 };
  const first = await request(app).post("/api/attendance/clock").set("Authorization", `Bearer ${employeeToken}`).send(payload);
  const second = await request(app).post("/api/attendance/clock").set("Authorization", `Bearer ${employeeToken}`).send(payload);
  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.ok(Math.abs(new Date(first.body.record.serverTimestamp).getTime() - Date.now()) < 10000);
});

test("מכירות מקבילות אינן מאפשרות מלאי שלילי", async () => {
  const sale = (quantity: number) => request(app).post("/api/sales").set("Authorization", `Bearer ${employeeToken}`).send({ productId: "product-white-roses", quantity });
  const responses = await Promise.all([sale(15), sale(10)]);
  assert.deepEqual(responses.map(item => item.status).sort(), [201, 409]);
  const inventory = await prisma.stationInventory.findUniqueOrThrow({ where: { stationId_productId: { stationId: 1, productId: "product-white-roses" } } });
  assert.ok(inventory.quantity === 5 || inventory.quantity === 10);
  assert.equal(await prisma.sale.count(), 1);
  assert.equal(await prisma.inventoryTransaction.count(), 1);
});

test("JWT לא תקין ו־JWT שפג תוקפו נדחים", async () => {
  assert.equal((await request(app).get("/api/me").set("Authorization", "Bearer invalid-token")).status, 401);
  const expired = await new SignJWT({ role: "EMPLOYEE", employeeId: "emp-1", stationId: 1 }).setProtectedHeader({ alg: "HS256" }).setSubject("user-employee-1").setIssuer("linoy-designs-api").setAudience("linoy-designs-app").setIssuedAt(Math.floor(Date.now() / 1000) - 100).setExpirationTime(Math.floor(Date.now() / 1000) - 1).sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
  const response = await request(app).get("/api/me").set("Authorization", `Bearer ${expired}`);
  assert.equal(response.status, 401);
  assert.equal(response.body.error, "פג תוקף ההתחברות");
});

test("אסימון רענון מסתובב ושימוש חוזר מבטל את המשפחה", async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "maya@linoy-designs.example", password: employeePassword });
  const originalCookie = login.headers["set-cookie"][0].split(";")[0];
  const rawOriginal = originalCookie.split("=")[1];
  const originalStored = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: createHash("sha256").update(rawOriginal).digest("hex") } });
  const refresh = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie).send({});
  assert.equal(refresh.status, 200);
  const reused = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie).send({});
  assert.equal(reused.status, 401);
  const activeTokens = await prisma.refreshToken.count({ where: { familyId: originalStored.familyId, revokedAt: null } });
  assert.equal(activeTokens, 0);
});

test("המסד שומר hash של אסימון רענון ולא את האסימון הגולמי", async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "maya@linoy-designs.example", password: employeePassword });
  const raw = login.headers["set-cookie"][0].split(";")[0].split("=")[1];
  const stored = await prisma.refreshToken.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  assert.notEqual(stored.tokenHash, raw);
  assert.match(stored.tokenHash, /^[a-f0-9]{64}$/);
});

test("תגובות התחברות אינן חושפות hashes או סודות", async () => {
  const response = await request(app).post("/api/auth/login").send({ email: "owner@linoy-designs.example", password: adminPassword });
  const body = JSON.stringify(response.body);
  assert.equal(body.includes("passwordHash"), false);
  assert.equal(body.includes("tokenHash"), false);
  assert.equal(body.includes(process.env.JWT_ACCESS_SECRET!), false);
});

test("תיקון מנהל יוצר AuditLog עם ערך מקורי, חדש וסיבה", async () => {
  const record = await prisma.attendanceRecord.create({ data: { employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", latitude: 32.0743, longitude: 34.7925, distanceMeters: 0 } });
  const nextTime = new Date(Date.now() + 60000);
  const response = await request(app).patch(`/api/attendance/${record.id}`).set("Authorization", `Bearer ${adminToken}`).send({ reason: "תיקון מאושר לפי דוח עובד", changes: { serverTimestamp: nextTime.toISOString() } });
  assert.equal(response.status, 200);
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: record.id } });
  assert.equal(audit.adminUserId, "user-admin");
  assert.equal(audit.reason, "תיקון מאושר לפי דוח עובד");
  assert.ok(audit.originalValue);
  assert.ok(audit.newValue);
});

test("סיסמאות נשמרות כ-hash של bcrypt ואינן נשמרות כטקסט גלוי", async () => {
  const users = await prisma.user.findMany({ select: { email: true, passwordHash: true } });
  for (const user of users) {
    assert.ok(user.passwordHash);
    assert.match(user.passwordHash, /^\$2[aby]\$12\$/);
    assert.notEqual(user.passwordHash, adminPassword);
    assert.notEqual(user.passwordHash, employeePassword);
  }
});

test("כותרות Helmet ו-CORS מוגבל למקור המורשה", async () => {
  const allowed = await request(app).options("/api/auth/login").set("Origin", process.env.APP_ORIGIN!);
  assert.equal(allowed.headers["access-control-allow-origin"], process.env.APP_ORIGIN);
  assert.equal(allowed.headers["x-content-type-options"], "nosniff");
  assert.ok(allowed.headers["content-security-policy"]);

  const blocked = await request(app).options("/api/auth/login").set("Origin", "https://attacker.example");
  assert.notEqual(blocked.headers["access-control-allow-origin"], "https://attacker.example");
  assert.notEqual(blocked.headers["access-control-allow-origin"], "*");
});

test("נתיב ההתחברות מוגן בהגבלת קצב", async () => {
  let response: request.Response | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    response = await request(app).post("/api/auth/login").send({ email: "maya@linoy-designs.example", password: "Wrong-Password-2026!" });
  }
  assert.equal(response?.status, 429);
});

const nearStation = { latitude: 32.0743, longitude: 34.7925, gpsAccuracy: 5, deviceInfo: "בדיקת מובייל" };
const farFromStation = { latitude: 32.0843, longitude: 34.8025, gpsAccuracy: 12, deviceInfo: "בדיקת מובייל מרוחקת" };

test("כניסה חריגה נשמרת כממתינה וכניסה רגילה אינה דורשת אישור", async () => {
  const exceptional = await request(app).post("/api/attendance/clock").set("Authorization", `Bearer ${employeeToken}`).send({ action: "CLOCK_IN", ...farFromStation });
  assert.equal(exceptional.status, 201);
  assert.equal(exceptional.body.record.exceptional, true);
  assert.equal(exceptional.body.record.exceptionStatus, "PENDING");
  await prisma.attendanceRecord.deleteMany();
  const normal = await request(app).post("/api/attendance/clock").set("Authorization", `Bearer ${employeeToken}`).send({ action: "CLOCK_IN", ...nearStation });
  assert.equal(normal.status, 201);
  assert.equal(normal.body.record.exceptional, false);
  assert.equal(normal.body.record.exceptionStatus, "NONE");
});

test("יציאה חריגה נשמרת כממתינה", async () => {
  assert.equal((await request(app).post("/api/attendance/clock").set("Authorization", `Bearer ${employeeToken}`).send({ action: "CLOCK_IN", ...nearStation })).status, 201);
  const response = await request(app).post("/api/attendance/clock").set("Authorization", `Bearer ${employeeToken}`).send({ action: "CLOCK_OUT", ...farFromStation });
  assert.equal(response.status, 201);
  assert.equal(response.body.record.action, "CLOCK_OUT");
  assert.equal(response.body.record.exceptionStatus, "PENDING");
});

test("עובד אינו רשאי לאשר או לדחות חריגה והנתיב הממתין הוא למנהל בלבד", async () => {
  const record = await prisma.attendanceRecord.create({ data: { employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", ...farFromStation, distanceMeters: 1000, exceptional: true, exceptionStatus: "PENDING" } });
  assert.equal((await request(app).post(`/api/admin/attendance/${record.id}/approve`).set("Authorization", `Bearer ${employeeToken}`).send({})).status, 403);
  assert.equal((await request(app).post(`/api/admin/attendance/${record.id}/reject`).set("Authorization", `Bearer ${employeeToken}`).send({ reason: "דיווח לא מאומת" })).status, 403);
  assert.equal((await request(app).get("/api/admin/attendance/exceptions?status=PENDING").set("Authorization", `Bearer ${employeeToken}`)).status, 403);
});

test("מנהל מאשר חריגה, נוצר AuditLog ונתוני המקור נשמרים", async () => {
  const originalTime = new Date("2026-07-27T10:15:00.000Z");
  const record = await prisma.attendanceRecord.create({ data: { employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", ...farFromStation, distanceMeters: 1428, serverTimestamp: originalTime, exceptional: true, exceptionStatus: "PENDING" } });
  const response = await request(app).post(`/api/admin/attendance/${record.id}/approve`).set("Authorization", `Bearer ${adminToken}`).send({ reason: "אושר לאחר שיחה עם העובדת" });
  assert.equal(response.status, 200);
  const stored = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } });
  assert.equal(stored.exceptionStatus, "APPROVED");
  assert.equal(stored.reviewedByAdminId, "user-admin");
  assert.ok(stored.reviewedAt);
  assert.equal(stored.latitude, farFromStation.latitude);
  assert.equal(stored.longitude, farFromStation.longitude);
  assert.equal(stored.serverTimestamp.toISOString(), originalTime.toISOString());
  assert.equal(await prisma.auditLog.count({ where: { entityId: record.id, fieldName: "exceptionStatus", newValue: { equals: "APPROVED" } } }), 1);
});

test("מנהל דוחה חריגה רק עם סיבה ונוצר AuditLog", async () => {
  const record = await prisma.attendanceRecord.create({ data: { employeeId: "emp-1", stationId: 1, action: "CLOCK_OUT", ...farFromStation, distanceMeters: 1428, exceptional: true, exceptionStatus: "PENDING" } });
  assert.equal((await request(app).post(`/api/admin/attendance/${record.id}/reject`).set("Authorization", `Bearer ${adminToken}`).send({})).status, 400);
  const response = await request(app).post(`/api/admin/attendance/${record.id}/reject`).set("Authorization", `Bearer ${adminToken}`).send({ reason: "המיקום אינו תואם לדיווח" });
  assert.equal(response.status, 200);
  const stored = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } });
  assert.equal(stored.exceptionStatus, "REJECTED");
  assert.equal(stored.reviewReason, "המיקום אינו תואם לדיווח");
  assert.equal(await prisma.auditLog.count({ where: { entityId: record.id, fieldName: "exceptionStatus", newValue: { equals: "REJECTED" } } }), 1);
});

test("מנהל רואה רק חריגות ממתינות בבקשת הסינון", async () => {
  await prisma.attendanceRecord.createMany({ data: [
    { employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", ...farFromStation, distanceMeters: 900, exceptional: true, exceptionStatus: "PENDING" },
    { employeeId: "emp-1", stationId: 1, action: "CLOCK_OUT", ...farFromStation, distanceMeters: 900, exceptional: true, exceptionStatus: "APPROVED", reviewedByAdminId: "user-admin", reviewedAt: new Date() },
  ] });
  const response = await request(app).get("/api/admin/attendance/exceptions?status=PENDING").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.records[0].exceptionStatus, "PENDING");
});

test("ניהול עמדות דינמי הוא למנהל בלבד והכתובת אינה חובה", async () => {
  const payload = {
    name: "בדיקת עמדה זמנית", address: "", locationDescription: "ליד תחנת אוטובוס בכיוון מערב",
    latitude: 32.123456, longitude: 34.654321, allowedRadiusMeters: 120, active: true,
    startDate: "2026-08-01", endDate: "2026-08-15", internalNotes: "עמדה עונתית",
  };
  assert.equal((await request(app).post("/api/admin/stations").set("Authorization", `Bearer ${employeeToken}`).send(payload)).status, 403);
  const created = await request(app).post("/api/admin/stations").set("Authorization", `Bearer ${adminToken}`).send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.station.address, "");
  assert.equal(created.body.station.latitude, payload.latitude);
  assert.equal(created.body.station.locationDescription, payload.locationDescription);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "STATION", entityId: String(created.body.station.id) } }), 1);
});

test("השבתה והפעלה מחדש שומרות את העמדה ואת ההיסטוריה", async () => {
  const station = await prisma.station.create({ data: { name: "בדיקת עמדה היסטורית", address: "", latitude: 32.2, longitude: 34.8 } });
  const record = await prisma.attendanceRecord.create({ data: { employeeId: "emp-1", stationId: station.id, action: "CLOCK_IN", latitude: 32.2, longitude: 34.8, distanceMeters: 0 } });
  const disabled = await request(app).post(`/api/admin/stations/${station.id}/status`).set("Authorization", `Bearer ${adminToken}`).send({ active: false, reason: "סיום תקופת הפעילות" });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.station.active, false);
  assert.ok(await prisma.attendanceRecord.findUnique({ where: { id: record.id } }));
  const enabled = await request(app).post(`/api/admin/stations/${station.id}/status`).set("Authorization", `Bearer ${adminToken}`).send({ active: true, reason: "פתיחה מחודשת לעונה" });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.station.active, true);
});

test("ארכוב עמדה שומר את הרשומה, יומן הביקורת מאפשר שחזור", async () => {
  const station = await prisma.station.create({ data: { name: "בדיקת עמדה לארכיון", address: "", latitude: 32.2, longitude: 34.8 } });
  const archived = await request(app).post(`/api/admin/stations/${station.id}/archive`).set("Authorization", `Bearer ${adminToken}`).send({});
  assert.equal(archived.status, 200);
  assert.equal(archived.body.station.active, false);
  assert.ok(archived.body.station.archivedAt);
  assert.ok(await prisma.station.findUnique({ where: { id: station.id } }));
  assert.equal(await prisma.auditLog.count({ where: { entityType: "STATION", entityId: String(station.id), fieldName: "archivedAt" } }), 1);

  const restored = await request(app).post(`/api/admin/stations/${station.id}/restore`).set("Authorization", `Bearer ${adminToken}`).send({});
  assert.equal(restored.status, 200);
  assert.equal(restored.body.station.active, false);
  assert.equal(restored.body.station.archivedAt, null);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "STATION", entityId: String(station.id), fieldName: "archivedAt" } }), 2);

  await request(app).post(`/api/admin/stations/${station.id}/archive`).set("Authorization", `Bearer ${adminToken}`).send({});
  const restoredActive = await request(app).post(`/api/admin/stations/${station.id}/restore`).set("Authorization", `Bearer ${adminToken}`).send({ active: true });
  assert.equal(restoredActive.status, 200);
  assert.equal(restoredActive.body.station.active, true);
  assert.equal(restoredActive.body.station.archivedAt, null);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "STATION", entityId: String(station.id), fieldName: "archivedAt" } }), 4);
});

test("מחיקה לצמיתות דורשת ארכיון ואימות שם מדויק", async () => {
  const station = await prisma.station.create({ data: { name: "בדיקת עמדה למחיקה סופית", address: "", latitude: 32.2, longitude: 34.8 } });
  assert.equal((await request(app).delete(`/api/admin/stations/${station.id}`).set("Authorization", `Bearer ${adminToken}`).send({ confirmationName: station.name })).status, 409);
  await request(app).post(`/api/admin/stations/${station.id}/archive`).set("Authorization", `Bearer ${adminToken}`).send({});
  assert.equal((await request(app).delete(`/api/admin/stations/${station.id}`).set("Authorization", `Bearer ${adminToken}`).send({ confirmationName: "שם שגוי" })).status, 409);
  assert.equal((await request(app).delete(`/api/admin/stations/${station.id}`).set("Authorization", `Bearer ${adminToken}`).send({ confirmationName: station.name })).status, 200);
  assert.equal(await prisma.station.findUnique({ where: { id: station.id } }), null);
});

test("מנהל מוחק לצמיתות עמדה מהארכיון יחד עם היסטוריית העמדה", async () => {
  const station = await prisma.station.create({ data: { name: "בדיקת עמדה עם היסטוריה", address: "", latitude: 32.2, longitude: 34.8 } });
  const attendance = await prisma.attendanceRecord.create({ data: { employeeId: "emp-1", stationId: station.id, action: "CLOCK_IN", latitude: 32.2, longitude: 34.8, distanceMeters: 0 } });
  const inventoryTransaction = await prisma.inventoryTransaction.create({ data: { stationId: station.id, productId: "product-white-roses", transactionType: "INITIAL_COUNT", quantityDelta: 4, previousQuantity: 0, newQuantity: 4, adminUserId: "user-admin", reason: "בדיקת מחיקה סופית" } });
  await request(app).post(`/api/admin/stations/${station.id}/archive`).set("Authorization", `Bearer ${adminToken}`).send({});
  const deleted = await request(app).delete(`/api/admin/stations/${station.id}`).set("Authorization", `Bearer ${adminToken}`).send({ confirmationName: station.name });
  assert.equal(deleted.status, 200);
  assert.equal(await prisma.station.findUnique({ where: { id: station.id } }), null);
  assert.equal(await prisma.attendanceRecord.findUnique({ where: { id: attendance.id } }), null);
  assert.equal(await prisma.inventoryTransaction.findUnique({ where: { id: inventoryTransaction.id } }), null);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "STATION", entityId: String(station.id), fieldName: "permanentlyDeleted" } }), 1);
});

test("שכפול עמדה יוצר מזהה חדש ואינו תלוי במספר עמדות קבוע", async () => {
  const source = await prisma.station.create({ data: { name: "בדיקת עמדה מקור", address: "", latitude: 31.9, longitude: 34.7 } });
  const response = await request(app).post(`/api/admin/stations/${source.id}/duplicate`).set("Authorization", `Bearer ${adminToken}`).send({ name: "בדיקת עמדה משוכפלת", copyInventory: true });
  assert.equal(response.status, 201);
  assert.notEqual(response.body.station.id, source.id);
  const bootstrap = await request(app).get("/api/admin/bootstrap").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(bootstrap.status, 200);
  assert.ok(bootstrap.body.stations.some((item: { id: number }) => item.id === source.id));
  assert.ok(bootstrap.body.stations.some((item: { id: number }) => item.id === response.body.station.id));
});

test("מנהל יוצר עמדה עם מלאי התחלתי בעסקה אחת", async () => {
  const payload = {
    name: "בדיקת עמדה עם מלאי", address: "", locationDescription: "נקודה שנבחרה במפה",
    latitude: 32.111111, longitude: 34.777777, allowedRadiusMeters: 150, active: true,
    products: [{ productId: "product-white-roses", initialQuantity: 17 }],
  };
  const response = await request(app).post("/api/admin/stations").set("Authorization", `Bearer ${adminToken}`).send(payload);
  assert.equal(response.status, 201);
  const stationId = response.body.station.id;
  const inventory = await prisma.stationInventory.findUniqueOrThrow({ where: { stationId_productId: { stationId, productId: "product-white-roses" } } });
  assert.equal(inventory.quantity, 17);
  assert.equal(await prisma.inventoryTransaction.count({ where: { stationId, transactionType: "INITIAL_COUNT", newQuantity: 17 } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "STATION", entityId: String(stationId) } }), 1);
});

test("מנהל מוסיף מוצר לעמדה, כפילות נדחית ועובד אינו מורשה", async () => {
  const station = await prisma.station.create({ data: { name: "בדיקת עמדה להוספה", address: "", latitude: 32.1, longitude: 34.8 } });
  const payload = { productId: "product-white-roses", initialQuantity: 8, reason: "מלאי פתיחה לעמדה" };
  assert.equal((await request(app).post(`/api/admin/stations/${station.id}/products`).set("Authorization", `Bearer ${employeeToken}`).send(payload)).status, 403);
  assert.equal((await request(app).post(`/api/admin/stations/${station.id}/products`).set("Authorization", `Bearer ${adminToken}`).send(payload)).status, 201);
  assert.equal((await request(app).post(`/api/admin/stations/${station.id}/products`).set("Authorization", `Bearer ${adminToken}`).send(payload)).status, 409);
});

test("מוצר לא פעיל אינו ניתן להוספה לעמדה", async () => {
  await prisma.product.create({ data: { id: "product-test-inactive", name: "זר בדיקה לא פעיל", currentPriceCents: 1000, active: false } });
  const station = await prisma.station.create({ data: { name: "בדיקת עמדה מוצר לא פעיל", address: "", latitude: 32.1, longitude: 34.8 } });
  const response = await request(app).post(`/api/admin/stations/${station.id}/products`).set("Authorization", `Bearer ${adminToken}`).send({ productId: "product-test-inactive", initialQuantity: 3, reason: "בדיקת מוצר לא פעיל" });
  assert.equal(response.status, 409);
  assert.equal(await prisma.stationInventory.count({ where: { stationId: station.id } }), 0);
});

test("מנהל מוסיף, מפחית ומתקן ספירת מלאי", async () => {
  const endpoint = "/api/admin/stations/1/products/product-white-roses";
  const add = await request(app).patch(endpoint).set("Authorization", `Bearer ${adminToken}`).send({ quantityDelta: 5, transactionType: "STOCK_DELIVERY", reason: "משלוח חדש" });
  assert.equal(add.status, 200);
  const remove = await request(app).patch(endpoint).set("Authorization", `Bearer ${adminToken}`).send({ quantityDelta: -3, transactionType: "DAMAGED_REMOVAL", reason: "פריטים פגומים" });
  assert.equal(remove.status, 200);
  const correct = await request(app).patch(endpoint).set("Authorization", `Bearer ${adminToken}`).send({ quantityDelta: -10, transactionType: "MANUAL_ADJUSTMENT", reason: "ספירה ידנית" });
  assert.equal(correct.status, 200);
  assert.equal((await prisma.stationInventory.findUniqueOrThrow({ where: { stationId_productId: { stationId: 1, productId: "product-white-roses" } } })).quantity, 12);
});

test("השבתת מוצר בעמדה שומרת מלאי והיסטוריה ומונעת מכירה", async () => {
  const station = await prisma.station.create({ data: { name: "בדיקת עמדה להסרה", address: "", latitude: 32.1, longitude: 34.8, inventory: { create: { productId: "product-white-roses", quantity: 2 } } } });
  const disabled = await request(app).delete(`/api/admin/stations/${station.id}/products/product-white-roses`).set("Authorization", `Bearer ${adminToken}`).send({ reason: "הפסקת מכירת המוצר בעמדה" });
  assert.equal(disabled.status, 204);
  const inventory = await prisma.stationInventory.findUniqueOrThrow({ where: { stationId_productId: { stationId: station.id, productId: "product-white-roses" } } });
  assert.equal(inventory.active, false);
  assert.equal(inventory.quantity, 2);
  assert.equal(await prisma.auditLog.count({ where: { entityId: `${station.id}:product-white-roses`, fieldName: "productAssignment" } }), 1);
});

test("ניהול מוצרים הוא למנהל, גמיש ושומר מחיר היסטורי במכירה", async () => {
  const createPayload = { name: "זר בדיקה 137", price: 137, active: true };
  assert.equal((await request(app).post("/api/admin/products").set("Authorization", `Bearer ${employeeToken}`).send(createPayload)).status, 403);
  const created = await request(app).post("/api/admin/products").set("Authorization", `Bearer ${adminToken}`).send(createPayload);
  assert.equal(created.status, 201);
  const productId = created.body.product.id;
  assert.equal((await request(app).patch(`/api/admin/products/${productId}`).set("Authorization", `Bearer ${employeeToken}`).send({ price: 150, reason: "ניסיון אסור" })).status, 403);
  const updated = await request(app).patch(`/api/admin/products/${productId}`).set("Authorization", `Bearer ${adminToken}`).send({ name: "זר בדיקה חג", price: 150, reason: "עדכון מחיר לחג" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.product.currentPriceCents, 15000);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "PRODUCT", entityId: productId } }), 2);
  await prisma.product.delete({ where: { id: productId } });
});

test("מוצר מושבת בעמדה אינו מוצע לעובד ואינו ניתן למכירה", async () => {
  await request(app).delete("/api/admin/stations/1/products/product-white-roses").set("Authorization", `Bearer ${adminToken}`).send({ reason: "השבתה לצורך בדיקה" });
  const home = await request(app).get("/api/employee/home").set("Authorization", `Bearer ${employeeToken}`);
  assert.equal(home.status, 200);
  assert.equal(home.body.station.inventory.some((item: { productId: string }) => item.productId === "product-white-roses"), false);
  const sale = await request(app).post("/api/sales").set("Authorization", `Bearer ${employeeToken}`).send({ productId: "product-white-roses", quantity: 1 });
  assert.equal(sale.status, 409);
  assert.equal(await prisma.sale.count(), 0);
});

test("שינוי מחיר אינו משנה את מחיר המכירות ההיסטוריות", async () => {
  const originalProduct = await prisma.product.findUniqueOrThrow({ where: { id: "product-white-roses" } });
  const sale = await request(app).post("/api/sales").set("Authorization", `Bearer ${employeeToken}`).send({ productId: "product-white-roses", quantity: 1 });
  assert.equal(sale.status, 201);
  const originalUnitPrice = sale.body.sale.unitPriceCents;
  const changed = await request(app).patch("/api/admin/products/product-white-roses").set("Authorization", `Bearer ${adminToken}`).send({ price: originalUnitPrice / 100 + 25, reason: "עדכון מחיר עונתי" });
  assert.equal(changed.status, 200);
  const storedSale = await prisma.sale.findUniqueOrThrow({ where: { id: sale.body.sale.id } });
  assert.equal(storedSale.unitPriceCents, originalUnitPrice);
  assert.equal(storedSale.totalAmountCents, originalUnitPrice);
  await prisma.product.update({ where: { id: "product-white-roses" }, data: { currentPriceCents: originalProduct.currentPriceCents } });
});

test("עריכת סוג זר בעמדה מעדכנת שם מחיר וכמות אטומית בלי לשנות כמות בעמדה אחרת", async () => {
  const product = await prisma.product.create({ data: { id: "product-test-station-details", name: "זר לפני עריכה", currentPriceCents: 5000, active: true } });
  const stationA = await prisma.station.create({ data: { name: "בדיקת עמדה עריכה א", address: "", latitude: 32.1, longitude: 34.8, inventory: { create: { productId: product.id, quantity: 20 } } } });
  const stationB = await prisma.station.create({ data: { name: "בדיקת עמדה עריכה ב", address: "", latitude: 32.2, longitude: 34.9, inventory: { create: { productId: product.id, quantity: 8 } } } });
  const url = `/api/admin/stations/${stationA.id}/products/${product.id}/details`;
  assert.equal((await request(app).patch(url).set("Authorization", `Bearer ${employeeToken}`).send({ name: "זר מעודכן", price: 70, quantity: 15, reason: "ניסיון עובד" })).status, 403);
  assert.equal((await request(app).patch(url).set("Authorization", `Bearer ${adminToken}`).send({ name: "", price: -1, quantity: -1, reason: "ערכים שגויים" })).status, 400);
  const response = await request(app).patch(url).set("Authorization", `Bearer ${adminToken}`).send({ name: "זר חג מעודכן", price: 90, quantity: 0, reason: "עדכון עונתי וספירה" });
  assert.equal(response.status, 200);
  const [storedProduct, inventoryA, inventoryB] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
    prisma.stationInventory.findUniqueOrThrow({ where: { stationId_productId: { stationId: stationA.id, productId: product.id } } }),
    prisma.stationInventory.findUniqueOrThrow({ where: { stationId_productId: { stationId: stationB.id, productId: product.id } } }),
  ]);
  assert.equal(storedProduct.name, "זר חג מעודכן");
  assert.equal(storedProduct.currentPriceCents, 9000);
  assert.equal(inventoryA.quantity, 0);
  assert.equal(inventoryB.quantity, 8);
  assert.equal(await prisma.inventoryTransaction.count({ where: { stationId: stationA.id, productId: product.id, transactionType: "MANUAL_ADJUSTMENT", newQuantity: 0 } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entityId: `${stationA.id}:${product.id}`, fieldName: "quantity" } }), 1);
});

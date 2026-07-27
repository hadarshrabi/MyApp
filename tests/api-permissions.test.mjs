import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/api-core.mjs";

class MemoryRepository {
  constructor(session) {
    this.session = session;
    this.attendance = [{ id: "att-1", employeeId: "emp-1", stationId: 1, action: "CLOCK_IN", serverTimestamp: "2026-07-27T08:00:00.000Z" }];
    this.inventory = [{ stationId: 1, productId: "product-white-roses", name: "זר ורדים לבנים", quantity: 20, unitPriceCents: 18900 }];
    this.audit = [];
  }
  async authenticate() { return this.session; }
  async getStation() { return { id: 1, latitude: 32.0743, longitude: 34.7925, allowedRadiusMeters: 150 }; }
  async getAttendanceForEmployee(id) { return this.attendance.filter(item => item.employeeId === id); }
  async getAllAttendance() { return this.attendance; }
  async createAttendance(record) { this.attendance.push(record); return record; }
  async createManualAttendance(body, adminUserId, timestamp) { const record = { id: "manual-1", ...body, serverTimestamp: timestamp }; this.attendance.push(record); this.audit.push({ adminUserId, reason: body.reason }); return record; }
  async correctAttendance(id, changes, adminUserId, reason, timestamp) {
    const record = this.attendance.find(item => item.id === id); if (!record) return null;
    for (const [field, value] of Object.entries(changes)) { this.audit.push({ entityId: id, field, originalValue: record[field], newValue: value, adminUserId, reason, timestamp }); record[field] = value; }
    return record;
  }
  async getInventory(stationId) { return this.inventory.filter(item => item.stationId === stationId); }
  async createSaleAtomic(input) {
    const item = this.inventory.find(row => row.stationId === input.stationId && row.productId === input.productId);
    if (!item || item.quantity < input.quantity) throw new Error("אין מספיק מלאי לביצוע המכירה");
    const previousQuantity = item.quantity; item.quantity -= input.quantity;
    return { ...input, unitPriceCents: item.unitPriceCents, totalAmountCents: item.unitPriceCents * input.quantity, previousQuantity, newQuantity: item.quantity };
  }
  async adjustInventory(body, adminUserId, timestamp) {
    const item = this.inventory[0]; const previousQuantity = item.quantity; item.quantity += body.quantityDelta;
    this.audit.push({ originalValue: previousQuantity, newValue: item.quantity, adminUserId, reason: body.reason, timestamp });
    return { id: "tx-1", previousQuantity, newQuantity: item.quantity };
  }
}

const employee = { userId: "user-employee-1", employeeId: "emp-1", stationId: 1, role: "EMPLOYEE", name: "מיה אדרי" };
const admin = { userId: "user-admin", employeeId: null, stationId: null, role: "ADMIN", name: "לינוי רז" };
const request = (path, method = "GET", body) => new Request(`https://example.test${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });

test("עובד אינו יכול לתקן נוכחות ידנית", async () => {
  const response = await createApi(new MemoryRepository(employee))(request("/api/attendance/att-1", "PATCH", { reason: "ניסיון", changes: { serverTimestamp: "2020-01-01" } }));
  assert.equal(response.status, 403);
});

test("עובד אינו יכול לבצע התאמת מלאי ידנית", async () => {
  const response = await createApi(new MemoryRepository(employee))(request("/api/inventory/adjust", "POST", { stationId: 1, productId: "product-white-roses", quantityDelta: 5, reason: "ניסיון" }));
  assert.equal(response.status, 403);
});

test("דיווח נוכחות משתמש בזהות ובזמן השרת בלבד", async () => {
  const repo = new MemoryRepository(employee);
  const handle = createApi(repo, () => "2026-07-27T12:00:00.000Z");
  const response = await handle(request("/api/attendance/clock", "POST", { employeeId: "emp-other", stationId: 1, action: "CLOCK_IN", latitude: 32.0743, longitude: 34.7925, timestamp: "1999-01-01" }));
  const { record } = await response.json();
  assert.equal(response.status, 201);
  assert.equal(record.employeeId, "emp-1");
  assert.equal(record.serverTimestamp, "2026-07-27T12:00:00.000Z");
});

test("עובד רואה רק את רשומות הנוכחות שלו", async () => {
  const repo = new MemoryRepository(employee);
  repo.attendance.push({ id: "att-2", employeeId: "emp-2" });
  const response = await createApi(repo)(request("/api/attendance/me"));
  const { records } = await response.json();
  assert.deepEqual(records.map(item => item.employeeId), ["emp-1"]);
});

test("מכירה מפחיתה מלאי ושומרת מחיר וכמויות", async () => {
  const repo = new MemoryRepository(employee);
  const response = await createApi(repo, () => "2026-07-27T12:00:00.000Z")(request("/api/sales", "POST", { productId: "product-white-roses", quantity: 2 }));
  const { sale } = await response.json();
  assert.equal(response.status, 201);
  assert.equal(sale.previousQuantity, 20);
  assert.equal(sale.newQuantity, 18);
  assert.equal(sale.totalAmountCents, 37800);
});

test("מכירה נדחית כאשר אין מספיק מלאי", async () => {
  const response = await createApi(new MemoryRepository(employee))(request("/api/sales", "POST", { productId: "product-white-roses", quantity: 21 }));
  assert.equal(response.status, 409);
});

test("תיקון מנהל יוצר רישום ביקורת עם ערך מקורי וחדש", async () => {
  const repo = new MemoryRepository(admin);
  const response = await createApi(repo, () => "2026-07-27T13:00:00.000Z")(request("/api/attendance/att-1", "PATCH", { reason: "אישור טעות", changes: { serverTimestamp: "2026-07-27T08:05:00.000Z" } }));
  assert.equal(response.status, 200);
  assert.equal(repo.audit[0].originalValue, "2026-07-27T08:00:00.000Z");
  assert.equal(repo.audit[0].newValue, "2026-07-27T08:05:00.000Z");
  assert.equal(repo.audit[0].adminUserId, "user-admin");
  assert.equal(repo.audit[0].reason, "אישור טעות");
});

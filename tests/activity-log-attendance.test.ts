import test from "node:test";
import assert from "node:assert/strict";
import { mapAuditToActivity } from "../src/presentation/activityLog";

const base = { id: "audit-1", entityType: "ATTENDANCE", entityId: "clock-in-1", reason: "תיקון דיווח", serverTimestamp: "2026-08-21T08:00:00.000Z", adminUser: { displayName: "הדר" } };

test("תיקון משמרת מוצג בעברית עם before/after עסקי", () => {
  const item = mapAuditToActivity({ ...base, fieldName: "shiftCorrection", originalValue: { employeeName: "קובי", clockIn: "2026-08-21T05:00:00.000Z", clockOut: "2026-08-21T13:00:00.000Z", stationName: "קניון איילון" }, newValue: { employeeName: "קובי", clockIn: "2026-08-21T05:15:00.000Z", clockOut: "2026-08-21T13:42:00.000Z", stationName: "קניון איילון" } });
  assert.equal(item.description, "עדכן את שעות הנוכחות של");
  assert.equal(item.target, "קובי");
  assert.deepEqual(item.changes.map(change => change.label), ["כניסה", "יציאה"]);
  assert.equal(item.reason, "תיקון דיווח");
});

test("מחיקה לוגית מוצגת אנושית ואינה חושפת שדות שאינם ב-allowlist", () => {
  const item = mapAuditToActivity({ ...base, fieldName: "softDeleted", originalValue: { employeeName: "קובי", clockIn: "2026-08-21T05:00:00.000Z", deviceInfo: "sensitive" }, newValue: { employeeName: "קובי", clockIn: "2026-08-21T05:00:00.000Z", deleted: true, token: "secret" } });
  assert.equal(item.description, "מחק את רשומת הנוכחות של");
  assert.equal(item.target, "קובי");
  assert.ok(item.changes.every(change => !/token|device/i.test(change.label)));
});

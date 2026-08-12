import assert from "node:assert/strict";
import test from "node:test";
import { activityMatches, mapAuditToActivity, type AuditRecord } from "../src/presentation/activityLog";

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: "audit-1", entityType: "USER", entityId: "user-1", fieldName: "profileAndRole",
    originalValue: { displayName: "קובי", hourlyRateCents: 4500, passwordHash: "must-never-render" },
    newValue: { displayName: "קובי", hourlyRateCents: 5000, passwordHash: "still-secret" },
    reason: "עדכון תנאי העסקה", serverTimestamp: "2026-08-12T07:42:00.000Z",
    adminUser: { displayName: "הדר" }, ...overrides,
  };
}

test("maps a known event to a human Hebrew activity with safe before/after values", () => {
  const item = mapAuditToActivity(record(), { users: [{ id: "user-1", displayName: "קובי" }] });
  assert.equal(item.actor, "הדר");
  assert.equal(item.description, "עדכן את פרטי המשתמש");
  assert.equal(item.target, "קובי");
  assert.deepEqual(item.changes, [{ label: "שכר שעתי", before: "45 ₪", after: "50 ₪" }]);
  assert.doesNotMatch(JSON.stringify(item), /must-never-render|still-secret/);
});

test("masks sensitive fields and does not expose a sensitive reason", () => {
  const item = mapAuditToActivity(record({
    fieldName: "passwordHash", originalValue: "old", newValue: "new", reason: "JWT token secret rotated",
  }));
  assert.deepEqual(item.changes, []);
  assert.equal(item.reason, undefined);
  assert.doesNotMatch(JSON.stringify(item), /old|new|JWT token secret rotated/);
});

test("unknown events use a safe fallback and retain codes only in sanitized technical details", () => {
  const item = mapAuditToActivity(record({ entityType: "FUTURE_EVENT", fieldName: "RAW_ACTION", originalValue: { payload: "private" }, newValue: { payload: "private-new" } }));
  assert.equal(item.description, "ביצע פעולה במערכת");
  assert.equal(item.categoryLabel, "מערכת");
  assert.deepEqual(item.changes, []);
  assert.deepEqual(item.technical, { entityType: "FUTURE_EVENT", fieldName: "RAW_ACTION" });
  assert.doesNotMatch(JSON.stringify(item), /private-new|private/);
});

test("client-side search and supported category filters use presented business information", () => {
  const item = mapAuditToActivity(record(), { users: [{ id: "user-1", displayName: "קובי" }] });
  assert.equal(activityMatches(item, "קובי", "ALL"), true);
  assert.equal(activityMatches(item, "הדר", "USERS"), true);
  assert.equal(activityMatches(item, "קובי", "INVENTORY"), false);
});

test("password reset is presented as a human activity without password metadata", () => {
  const item = mapAuditToActivity(record({ fieldName: "passwordReset", originalValue: null, newValue: null, reason: "איפוס סיסמה על ידי מנהל" }), { users: [{ id: "user-1", displayName: "קובי" }] });
  assert.equal(item.description, "איפס את הסיסמה של המשתמש");
  assert.equal(item.target, "קובי");
  assert.deepEqual(item.changes, []);
  assert.doesNotMatch(JSON.stringify(item), /hash|token|length/i);
});

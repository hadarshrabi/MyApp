import assert from "node:assert/strict";
import test from "node:test";
import { pairAttendanceShifts, summarizeAttendanceShifts } from "../server/attendance-shifts";

let sequence = 0;
function record(employeeId: string, action: "CLOCK_IN" | "CLOCK_OUT", timestamp: string, options: { rate?: number; status?: "NONE" | "PENDING" | "APPROVED" | "REJECTED"; deleted?: boolean; stationId?: number } = {}) {
  sequence += 1;
  return {
    id: `record-${sequence}`, employeeId, stationId: options.stationId ?? 1, action,
    serverTimestamp: new Date(timestamp), exceptionStatus: options.status ?? "NONE" as const,
    deletedAt: options.deleted ? new Date() : null,
    hourlyRateCentsAtClockIn: action === "CLOCK_IN" ? options.rate ?? 5000 : null,
    station: { id: options.stationId ?? 1, name: `עמדה ${options.stationId ?? 1}` },
    employee: { user: { displayName: employeeId }, jobPosition: "עובד", hourlyRateCents: 9999 },
  };
}

test("pairs every clock-in/out as a separate shift and sums daily and monthly pay", () => {
  const shifts = pairAttendanceShifts([
    record("employee-1", "CLOCK_IN", "2026-08-21T04:00:00Z", { rate: 5000 }),
    record("employee-1", "CLOCK_OUT", "2026-08-21T05:00:00Z"),
    record("employee-1", "CLOCK_IN", "2026-08-21T13:00:00Z", { rate: 5000, stationId: 2 }),
    record("employee-1", "CLOCK_OUT", "2026-08-21T15:00:00Z", { stationId: 2 }),
    record("employee-1", "CLOCK_IN", "2026-08-22T05:00:00Z", { rate: 6000 }),
    record("employee-1", "CLOCK_OUT", "2026-08-22T06:30:00Z"),
  ]);
  assert.equal(shifts.length, 3);
  assert.deepEqual(shifts.map(shift => shift.durationMinutes).sort((a, b) => Number(a) - Number(b)), [60, 90, 120]);
  assert.deepEqual(shifts.map(shift => shift.shiftPayCents).sort((a, b) => Number(a) - Number(b)), [5000, 9000, 10000]);
  const result = summarizeAttendanceShifts(shifts);
  assert.equal(result.days.length, 2);
  const firstDay = result.days.find(day => day.date === "2026-08-21");
  assert.equal(firstDay?.shifts.length, 2);
  assert.equal(firstDay?.dailyMinutes, 180);
  assert.equal(firstDay?.dailyPayCents, 15000);
  assert.equal(result.summary.totalShifts, 3);
  assert.equal(result.summary.totalMinutes, 270);
  assert.equal(result.summary.totalPayCents, 24000);
});

test("cross-midnight belongs to Jerusalem clock-in day and open shifts are excluded from totals", () => {
  const shifts = pairAttendanceShifts([
    record("employee-1", "CLOCK_IN", "2026-08-21T20:30:00Z", { rate: 5000 }),
    record("employee-1", "CLOCK_OUT", "2026-08-22T00:30:00Z"),
    record("employee-1", "CLOCK_IN", "2026-08-22T07:00:00Z", { rate: 6000 }),
  ]);
  assert.equal(shifts[1].date, "2026-08-21");
  assert.equal(shifts[1].durationMinutes, 240);
  assert.equal(shifts[0].status, "OPEN");
  assert.equal(shifts[0].shiftPayCents, null);
  const result = summarizeAttendanceShifts(shifts);
  assert.equal(result.summary.totalShifts, 1);
  assert.equal(result.summary.totalPayCents, 20000);
});

test("soft-deleted and rejected records do not affect shift or totals", () => {
  const shifts = pairAttendanceShifts([
    record("employee-1", "CLOCK_IN", "2026-08-21T04:00:00Z", { deleted: true }),
    record("employee-1", "CLOCK_OUT", "2026-08-21T05:00:00Z", { deleted: true }),
    record("employee-1", "CLOCK_IN", "2026-08-22T04:00:00Z", { status: "REJECTED" }),
    record("employee-1", "CLOCK_OUT", "2026-08-22T05:00:00Z", { status: "REJECTED" }),
  ]);
  assert.deepEqual(shifts, []);
  assert.deepEqual(summarizeAttendanceShifts(shifts).summary, { totalShifts: 0, totalMinutes: 0, totalPayCents: 0 });
});

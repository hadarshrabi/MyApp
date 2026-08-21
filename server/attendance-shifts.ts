type ShiftRecord = {
  id: string;
  employeeId: string;
  stationId: number;
  action: "CLOCK_IN" | "CLOCK_OUT";
  serverTimestamp: Date;
  exceptionStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  deletedAt?: Date | null;
  hourlyRateCentsAtClockIn?: number | null;
  station?: { id?: number; name: string; address?: string | null; locationDescription?: string | null; latitude?: number; longitude?: number };
  employee?: { user: { displayName: string }; jobPosition?: string; hourlyRateCents?: number };
};

export type AttendanceShift = {
  id: string;
  employeeId: string;
  employeeName: string;
  jobPosition: string;
  date: string;
  clockInId: string;
  clockOutId: string | null;
  clockIn: string;
  clockOut: string | null;
  durationMinutes: number | null;
  hourlyRateCents: number;
  shiftPayCents: number | null;
  station: { id: number; name: string; address: string; locationDescription: string | null; latitude: number; longitude: number };
  status: "OPEN" | "COMPLETED" | "PENDING";
  includedInTotals: boolean;
};

const jerusalemDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
export function jerusalemDateKey(value: Date) { return jerusalemDate.format(value); }

export function pairAttendanceShifts(records: ShiftRecord[]): AttendanceShift[] {
  const byEmployee = new Map<string, ShiftRecord[]>();
  for (const record of records) {
    if (record.deletedAt || record.exceptionStatus === "REJECTED") continue;
    const list = byEmployee.get(record.employeeId) ?? [];
    list.push(record);
    byEmployee.set(record.employeeId, list);
  }
  const shifts: AttendanceShift[] = [];
  for (const employeeRecords of byEmployee.values()) {
    employeeRecords.sort((a, b) => a.serverTimestamp.getTime() - b.serverTimestamp.getTime() || a.id.localeCompare(b.id));
    let open: ShiftRecord | null = null;
    for (const record of employeeRecords) {
      if (record.action === "CLOCK_IN") {
        if (!open) open = record;
        continue;
      }
      if (!open || record.serverTimestamp <= open.serverTimestamp) continue;
      shifts.push(toShift(open, record));
      open = null;
    }
    if (open) shifts.push(toShift(open, null));
  }
  return shifts.sort((a, b) => b.clockIn.localeCompare(a.clockIn));
}

function toShift(clockIn: ShiftRecord, clockOut: ShiftRecord | null): AttendanceShift {
  const hourlyRateCents = clockIn.hourlyRateCentsAtClockIn ?? clockIn.employee?.hourlyRateCents ?? 0;
  const durationMinutes = clockOut ? Math.max(0, Math.round((clockOut.serverTimestamp.getTime() - clockIn.serverTimestamp.getTime()) / 60000)) : null;
  const pending = clockIn.exceptionStatus === "PENDING" || clockOut?.exceptionStatus === "PENDING";
  const completed = durationMinutes !== null;
  const includedInTotals = completed && !pending;
  const station = clockIn.station;
  return {
    id: `${clockIn.id}:${clockOut?.id ?? "open"}`,
    employeeId: clockIn.employeeId,
    employeeName: clockIn.employee?.user.displayName ?? clockIn.employeeId,
    jobPosition: clockIn.employee?.jobPosition ?? "",
    date: jerusalemDateKey(clockIn.serverTimestamp),
    clockInId: clockIn.id,
    clockOutId: clockOut?.id ?? null,
    clockIn: clockIn.serverTimestamp.toISOString(),
    clockOut: clockOut?.serverTimestamp.toISOString() ?? null,
    durationMinutes,
    hourlyRateCents,
    shiftPayCents: includedInTotals ? Math.round(durationMinutes! / 60 * hourlyRateCents) : null,
    station: { id: clockIn.stationId, name: station?.name ?? `עמדה ${clockIn.stationId}`, address: station?.address ?? "", locationDescription: station?.locationDescription ?? null, latitude: station?.latitude ?? 0, longitude: station?.longitude ?? 0 },
    status: pending ? "PENDING" : completed ? "COMPLETED" : "OPEN",
    includedInTotals,
  };
}

export function summarizeAttendanceShifts(shifts: AttendanceShift[]) {
  const daily = new Map<string, { date: string; shifts: AttendanceShift[]; dailyMinutes: number; dailyPayCents: number }>();
  for (const shift of shifts) {
    const group = daily.get(shift.date) ?? { date: shift.date, shifts: [], dailyMinutes: 0, dailyPayCents: 0 };
    group.shifts.push(shift);
    if (shift.includedInTotals) {
      group.dailyMinutes += shift.durationMinutes ?? 0;
      group.dailyPayCents += shift.shiftPayCents ?? 0;
    }
    daily.set(shift.date, group);
  }
  const days = [...daily.values()].sort((a, b) => b.date.localeCompare(a.date));
  return {
    days,
    summary: {
      totalShifts: shifts.filter(shift => shift.includedInTotals).length,
      totalMinutes: days.reduce((sum, day) => sum + day.dailyMinutes, 0),
      totalPayCents: days.reduce((sum, day) => sum + day.dailyPayCents, 0),
    },
  };
}

ALTER TABLE "AttendanceRecord"
ADD COLUMN "hourlyRateCentsAtClockIn" INTEGER;

UPDATE "AttendanceRecord" AS attendance
SET "hourlyRateCentsAtClockIn" = employee."hourlyRateCents"
FROM "Employee" AS employee
WHERE attendance."employeeId" = employee."id"
  AND attendance."action" = 'CLOCK_IN'
  AND attendance."hourlyRateCentsAtClockIn" IS NULL;

ALTER TABLE "AttendanceRecord"
ADD CONSTRAINT "AttendanceRecord_hourlyRateCentsAtClockIn_check"
CHECK (
  "hourlyRateCentsAtClockIn" IS NULL
  OR "hourlyRateCentsAtClockIn" >= 0
);

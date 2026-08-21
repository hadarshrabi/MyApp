ALTER TABLE "AttendanceRecord" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "AttendanceRecord_deletedAt_employeeId_serverTimestamp_idx"
ON "AttendanceRecord"("deletedAt", "employeeId", "serverTimestamp");

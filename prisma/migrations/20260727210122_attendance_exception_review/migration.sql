-- CreateEnum
CREATE TYPE "AttendanceReviewStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "exceptionStatus" "AttendanceReviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByAdminId" TEXT;

-- CreateIndex
CREATE INDEX "AttendanceRecord_exceptionStatus_serverTimestamp_idx" ON "AttendanceRecord"("exceptionStatus", "serverTimestamp");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

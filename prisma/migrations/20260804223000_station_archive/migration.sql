ALTER TABLE "Station"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedByAdminId" TEXT,
ADD COLUMN "archiveReason" TEXT;

CREATE INDEX "Station_archivedAt_active_idx" ON "Station"("archivedAt", "active");

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "locationDescription" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

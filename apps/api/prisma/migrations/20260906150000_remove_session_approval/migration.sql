BEGIN;
ALTER TABLE "WorkSession" ADD COLUMN "legacyReviewStatus" TEXT;
UPDATE "WorkSession" SET "legacyReviewStatus" = "status"::text;
ALTER TYPE "WorkSessionStatus" RENAME TO "WorkSessionStatus_old";
CREATE TYPE "WorkSessionStatus" AS ENUM ('OPEN', 'COMPLETED');
ALTER TABLE "WorkSession" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WorkSession" ALTER COLUMN "status" TYPE "WorkSessionStatus"
  USING (CASE WHEN "endAt" IS NULL THEN 'OPEN' ELSE 'COMPLETED' END)::"WorkSessionStatus";
ALTER TABLE "WorkSession" ALTER COLUMN "status" SET DEFAULT 'OPEN';
UPDATE "WorkSession" SET "updatedAt" = CURRENT_TIMESTAMP;
DROP TYPE "WorkSessionStatus_old";
ALTER TABLE "PayrollLine" RENAME COLUMN "approvedMinutes" TO "completedMinutes";
COMMIT;

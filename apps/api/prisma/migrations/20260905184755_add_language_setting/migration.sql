-- CreateEnum
CREATE TYPE "AppLanguage" AS ENUM ('en', 'fa');

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "language" "AppLanguage" NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "language" "AppLanguage" NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "UploadedFile" ADD COLUMN "storage" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN "url" TEXT; 
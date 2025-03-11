/*
  Warnings:

  - You are about to drop the column `hash` on the `UploadedFile` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "UploadedFile_hash_projectId_idx";

-- AlterTable
ALTER TABLE "UploadedFile" DROP COLUMN "hash";

-- CreateIndex
CREATE INDEX "UploadedFile_projectId_idx" ON "UploadedFile"("projectId");

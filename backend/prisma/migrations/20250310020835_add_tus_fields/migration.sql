/*
  Warnings:

  - You are about to drop the column `filename` on the `UploadedFile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tusId]` on the table `UploadedFile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `UploadedFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UploadedFile" DROP COLUMN "filename",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "s3Bucket" TEXT,
ADD COLUMN     "s3Key" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'uploading',
ADD COLUMN     "tusId" TEXT,
ALTER COLUMN "path" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_tusId_key" ON "UploadedFile"("tusId");

-- CreateIndex
CREATE INDEX "UploadedFile_tusId_idx" ON "UploadedFile"("tusId");

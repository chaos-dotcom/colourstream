/*
  Warnings:

  - The `status` column on the `UploadedFile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('uploading', 'completed', 'cancelled', 'error');

-- AlterTable
ALTER TABLE "UploadedFile" DROP COLUMN "status",
ADD COLUMN     "status" "UploadStatus" NOT NULL DEFAULT 'uploading';

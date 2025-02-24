/*
  Warnings:

  - You are about to drop the `BlockedIP` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BlockedIP";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "blockedIP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hashedIP" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockAt" DATETIME,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "blockedIP_hashedIP_key" ON "blockedIP"("hashedIP");

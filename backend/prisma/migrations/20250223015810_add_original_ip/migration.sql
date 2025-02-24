/*
  Warnings:

  - Added the required column `originalIP` to the `blockedIP` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_blockedIP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hashedIP" TEXT NOT NULL,
    "originalIP" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockAt" DATETIME,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_blockedIP" ("blockedAt", "failedAttempts", "hashedIP", "id", "isActive", "reason", "unblockAt") SELECT "blockedAt", "failedAttempts", "hashedIP", "id", "isActive", "reason", "unblockAt" FROM "blockedIP";
DROP TABLE "blockedIP";
ALTER TABLE "new_blockedIP" RENAME TO "blockedIP";
CREATE UNIQUE INDEX "blockedIP_hashedIP_key" ON "blockedIP"("hashedIP");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

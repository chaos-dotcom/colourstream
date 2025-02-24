-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_obsSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER NOT NULL DEFAULT 4455,
    "password" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "streamType" TEXT NOT NULL DEFAULT 'rtmp',
    "srtUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_obsSettings" ("enabled", "host", "id", "password", "port", "updatedAt") SELECT "enabled", "host", "id", "password", "port", "updatedAt" FROM "obsSettings";
DROP TABLE "obsSettings";
ALTER TABLE "new_obsSettings" RENAME TO "obsSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

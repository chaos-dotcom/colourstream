-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_obsSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER NOT NULL DEFAULT 4455,
    "password" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "streamType" TEXT NOT NULL DEFAULT 'rtmp_custom',
    "protocol" TEXT NOT NULL DEFAULT 'rtmp',
    "useLocalNetwork" BOOLEAN NOT NULL DEFAULT true,
    "localNetworkMode" TEXT NOT NULL DEFAULT 'frontend',
    "localNetworkHost" TEXT DEFAULT 'localhost',
    "localNetworkPort" INTEGER DEFAULT 4455,
    "srtUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_obsSettings" ("enabled", "host", "id", "localNetworkHost", "localNetworkMode", "localNetworkPort", "password", "port", "srtUrl", "streamType", "updatedAt", "useLocalNetwork") SELECT "enabled", "host", "id", "localNetworkHost", "localNetworkMode", "localNetworkPort", "password", "port", "srtUrl", "streamType", "updatedAt", "useLocalNetwork" FROM "obsSettings";
DROP TABLE "obsSettings";
ALTER TABLE "new_obsSettings" RENAME TO "obsSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

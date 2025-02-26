-- Modified migration to add default value for presenterLink
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mirotalkRoomId" TEXT NOT NULL,
    "streamKey" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "displayPassword" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "link" TEXT NOT NULL,
    "presenterLink" TEXT NOT NULL DEFAULT (''),
    "mirotalkToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Room" ("id", "name", "mirotalkRoomId", "streamKey", "password", "displayPassword", "expiryDate", "link", "mirotalkToken", "createdAt") 
SELECT "id", "name", "mirotalkRoomId", "streamKey", "password", "displayPassword", "expiryDate", "link", "mirotalkToken", "createdAt" FROM "Room";

-- Update presenterLink based on link
UPDATE "new_Room" SET "presenterLink" = "link" || '/presenter';

DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_mirotalkRoomId_key" ON "Room"("mirotalkRoomId");
CREATE UNIQUE INDEX "Room_link_key" ON "Room"("link");
CREATE UNIQUE INDEX "Room_presenterLink_key" ON "Room"("presenterLink");
PRAGMA foreign_keys=ON;

-- CreateTable
CREATE TABLE "OBSSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "password" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "streamType" TEXT NOT NULL DEFAULT 'rtmp_custom',
    "protocol" TEXT NOT NULL DEFAULT 'rtmp',
    "useLocalNetwork" BOOLEAN NOT NULL DEFAULT true,
    "localNetworkMode" TEXT NOT NULL DEFAULT 'frontend',
    "localNetworkHost" TEXT,
    "localNetworkPort" INTEGER,
    "srtUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
); 
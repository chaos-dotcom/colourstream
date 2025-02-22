/*
  Warnings:

  - Added the required column `displayPassword` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Room" ("createdAt", "expiryDate", "id", "link", "mirotalkRoomId", "name", "password", "streamKey") SELECT "createdAt", "expiryDate", "id", "link", "mirotalkRoomId", "name", "password", "streamKey" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_mirotalkRoomId_key" ON "Room"("mirotalkRoomId");
CREATE UNIQUE INDEX "Room_link_key" ON "Room"("link");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

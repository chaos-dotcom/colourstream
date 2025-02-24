-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mirotalkRoomId" TEXT NOT NULL,
    "streamKey" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "link" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_mirotalkRoomId_key" ON "Room"("mirotalkRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_link_key" ON "Room"("link");

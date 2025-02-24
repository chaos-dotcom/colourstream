-- CreateTable
CREATE TABLE "OBSSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER NOT NULL DEFAULT 4455,
    "password" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "transports" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_userId_key" ON "WebAuthnCredential"("userId");

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mirotalkRoomId" TEXT NOT NULL,
    "streamKey" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "displayPassword" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "link" TEXT NOT NULL,
    "presenterLink" TEXT,
    "mirotalkToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obssettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obssettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockedIP" (
    "id" TEXT NOT NULL,
    "hashedIP" TEXT NOT NULL,
    "originalIP" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "blockedIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OIDCConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "providerName" TEXT NOT NULL DEFAULT 'Generic',
    "clientId" TEXT,
    "clientSecret" TEXT,
    "discoveryUrl" TEXT,
    "authorizationUrl" TEXT,
    "tokenUrl" TEXT,
    "userInfoUrl" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'openid profile email',
    "redirectUri" TEXT,
    "logoutUrl" TEXT,
    "group" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OIDCConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_mirotalkRoomId_key" ON "Room"("mirotalkRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_streamKey_key" ON "Room"("streamKey");

-- CreateIndex
CREATE UNIQUE INDEX "Room_link_key" ON "Room"("link");

-- CreateIndex
CREATE UNIQUE INDEX "Room_presenterLink_key" ON "Room"("presenterLink");

-- CreateIndex
CREATE UNIQUE INDEX "blockedIP_hashedIP_key" ON "blockedIP"("hashedIP");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId"); 
-- AlterEnum
ALTER TYPE "PointReason" ADD VALUE 'CASINO';

-- CreateTable
CREATE TABLE "CasinoSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyLossLimit" INTEGER NOT NULL DEFAULT 150,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasinoSettings_pkey" PRIMARY KEY ("id")
);

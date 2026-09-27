-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PointReason" ADD VALUE 'GIFT';
ALTER TYPE "PointReason" ADD VALUE 'LEISURE';

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "itemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GardenPlot" (
    "id" INTEGER NOT NULL,
    "crop" TEXT,
    "plantedById" TEXT,
    "plantedAt" TIMESTAMP(3),
    "growthMs" INTEGER NOT NULL DEFAULT 0,
    "growthAt" TIMESTAMP(3),
    "wateredUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GardenPlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishCatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "caughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FishCatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcadeScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArcadeScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gift_toId_openedAt_idx" ON "Gift"("toId", "openedAt");

-- CreateIndex
CREATE INDEX "FishCatch_userId_species_idx" ON "FishCatch"("userId", "species");

-- CreateIndex
CREATE INDEX "ArcadeScore_game_createdAt_idx" ON "ArcadeScore"("game", "createdAt");

-- CreateIndex
CREATE INDEX "ArcadeScore_userId_game_idx" ON "ArcadeScore"("userId", "game");

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GardenPlot" ADD CONSTRAINT "GardenPlot_plantedById_fkey" FOREIGN KEY ("plantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishCatch" ADD CONSTRAINT "FishCatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeScore" ADD CONSTRAINT "ArcadeScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

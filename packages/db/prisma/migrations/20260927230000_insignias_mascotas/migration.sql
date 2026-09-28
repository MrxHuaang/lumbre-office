-- CreateTable
CREATE TABLE "FeaturedBadge" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedBadge_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PetBond" (
    "petId" TEXT NOT NULL,
    "ownerId" TEXT,
    "love" INTEGER NOT NULL DEFAULT 0,
    "loveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adoptedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetBond_pkey" PRIMARY KEY ("petId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PetBond_ownerId_key" ON "PetBond"("ownerId");

-- AddForeignKey
ALTER TABLE "FeaturedBadge" ADD CONSTRAINT "FeaturedBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetBond" ADD CONSTRAINT "PetBond_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

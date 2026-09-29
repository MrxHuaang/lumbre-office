-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('ACTIVE', 'DONE', 'CLAIMED');

-- AlterEnum
ALTER TYPE "PointReason" ADD VALUE 'QUEST';

-- CreateTable
CREATE TABLE "QuestProgress" (
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "goal" INTEGER NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("userId","questId","period")
);

-- CreateTable
CREATE TABLE "SkillXp" (
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillXp_pkey" PRIMARY KEY ("userId","skill")
);

-- CreateIndex
CREATE INDEX "QuestProgress_userId_period_idx" ON "QuestProgress"("userId", "period");

-- CreateIndex
CREATE INDEX "QuestProgress_userId_status_idx" ON "QuestProgress"("userId", "status");

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillXp" ADD CONSTRAINT "SkillXp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


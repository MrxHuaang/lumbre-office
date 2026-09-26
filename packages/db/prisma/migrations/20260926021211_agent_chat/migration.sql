-- AlterTable
ALTER TABLE "AgentRunLog" ALTER COLUMN "taskId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AgentChat" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentChat_agentId_userId_createdAt_idx" ON "AgentChat"("agentId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentChat" ADD CONSTRAINT "AgentChat_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentChat" ADD CONSTRAINT "AgentChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

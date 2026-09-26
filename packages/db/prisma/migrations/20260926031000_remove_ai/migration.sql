-- DropForeignKey
ALTER TABLE "AgentChat" DROP CONSTRAINT "AgentChat_agentId_fkey";

-- DropForeignKey
ALTER TABLE "AgentChat" DROP CONSTRAINT "AgentChat_userId_fkey";

-- DropForeignKey
ALTER TABLE "AgentMessage" DROP CONSTRAINT "AgentMessage_fromAgentId_fkey";

-- DropForeignKey
ALTER TABLE "AgentMessage" DROP CONSTRAINT "AgentMessage_taskId_fkey";

-- DropForeignKey
ALTER TABLE "AgentRunLog" DROP CONSTRAINT "AgentRunLog_agentId_fkey";

-- DropForeignKey
ALTER TABLE "AgentRunLog" DROP CONSTRAINT "AgentRunLog_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Artifact" DROP CONSTRAINT "Artifact_taskId_fkey";

-- DropForeignKey
ALTER TABLE "SubTask" DROP CONSTRAINT "SubTask_agentId_fkey";

-- DropForeignKey
ALTER TABLE "SubTask" DROP CONSTRAINT "SubTask_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_ownerId_fkey";

-- DropTable
DROP TABLE "AgentChat";

-- DropTable
DROP TABLE "AgentDefinition";

-- DropTable
DROP TABLE "AgentMessage";

-- DropTable
DROP TABLE "AgentRunLog";

-- DropTable
DROP TABLE "Artifact";

-- DropTable
DROP TABLE "SubTask";

-- DropTable
DROP TABLE "Task";

-- DropEnum
DROP TYPE "TaskStatus";


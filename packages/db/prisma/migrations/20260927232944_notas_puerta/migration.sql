-- CreateTable
CREATE TABLE "DoorNote" (
    "id" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "DoorNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoorNote_toId_createdAt_idx" ON "DoorNote"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "DoorNote_fromId_createdAt_idx" ON "DoorNote"("fromId", "createdAt");

-- AddForeignKey
ALTER TABLE "DoorNote" ADD CONSTRAINT "DoorNote_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorNote" ADD CONSTRAINT "DoorNote_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

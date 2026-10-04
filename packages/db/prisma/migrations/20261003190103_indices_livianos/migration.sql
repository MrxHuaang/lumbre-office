-- DropIndex
DROP INDEX "ArcadeScore_userId_game_idx";

-- CreateIndex
CREATE INDEX "ArcadeScore_userId_game_createdAt_idx" ON "ArcadeScore"("userId", "game", "createdAt");

-- CreateIndex
CREATE INDEX "Gift_fromId_createdAt_idx" ON "Gift"("fromId", "createdAt");

-- CreateIndex
CREATE INDEX "Mission_status_completedAt_idx" ON "Mission"("status", "completedAt");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_refId_idx" ON "PointTransaction"("userId", "refId");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_createdAt_idx" ON "PointTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointTransaction_reason_createdAt_idx" ON "PointTransaction"("reason", "createdAt");

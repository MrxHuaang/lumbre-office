-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "content" JSONB,
ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Note_parentId_idx" ON "Note"("parentId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

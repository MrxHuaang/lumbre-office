-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "takenById" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "people" JSONB NOT NULL,
    "image" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_createdAt_idx" ON "Photo"("createdAt");

-- CreateIndex
CREATE INDEX "Photo_takenById_createdAt_idx" ON "Photo"("takenById", "createdAt");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Whiteboard" (
    "zoneId" TEXT NOT NULL,
    "strokes" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Whiteboard_pkey" PRIMARY KEY ("zoneId")
);

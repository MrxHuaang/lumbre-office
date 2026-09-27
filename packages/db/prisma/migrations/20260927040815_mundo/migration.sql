-- CreateTable
CREATE TABLE "WorldLayout" (
    "area" TEXT NOT NULL,
    "edits" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "WorldLayout_pkey" PRIMARY KEY ("area")
);

-- CreateTable
CREATE TABLE "UserLeadHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadIdentifier" TEXT NOT NULL,
    "searchQuery" TEXT,
    "leadType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLeadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLeadHistory_userId_leadIdentifier_idx" ON "UserLeadHistory"("userId", "leadIdentifier");

-- CreateIndex
CREATE INDEX "UserLeadHistory_createdAt_idx" ON "UserLeadHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserLeadHistory_userId_leadIdentifier_key" ON "UserLeadHistory"("userId", "leadIdentifier");

-- AddForeignKey
ALTER TABLE "UserLeadHistory" ADD CONSTRAINT "UserLeadHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

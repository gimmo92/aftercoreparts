-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "privacyConsent" BOOLEAN NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "imageHash" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "imageDeletedAt" TIMESTAMP(3),
    "machineBrand" TEXT,
    "machineModel" TEXT,
    "notes" TEXT,
    "ipHash" TEXT NOT NULL,
    "leadId" TEXT,
    "cacheOfId" TEXT,
    "componentType" TEXT,
    "brand" TEXT,
    "codes" JSONB NOT NULL DEFAULT '[]',
    "visibleFeatures" TEXT,
    "suggestedQueries" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL,
    "serpApiCalls" INTEGER NOT NULL DEFAULT 0,
    "vlmInputTokens" INTEGER NOT NULL DEFAULT 0,
    "vlmOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchResult" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT,
    "snippet" TEXT,
    "thumbnailUrl" TEXT,
    "price" TEXT,
    "confidence" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sellsPart" BOOLEAN NOT NULL,
    "origin" TEXT NOT NULL,

    CONSTRAINT "SearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Search_imageHash_idx" ON "Search"("imageHash");

-- CreateIndex
CREATE INDEX "Search_ipHash_idx" ON "Search"("ipHash");

-- CreateIndex
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");

-- CreateIndex
CREATE INDEX "Search_leadId_createdAt_idx" ON "Search"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Search_ipHash_leadId_idx" ON "Search"("ipHash", "leadId");

-- CreateIndex
CREATE INDEX "SearchResult_searchId_idx" ON "SearchResult"("searchId");

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_cacheOfId_fkey" FOREIGN KEY ("cacheOfId") REFERENCES "Search"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE CASCADE ON UPDATE CASCADE;

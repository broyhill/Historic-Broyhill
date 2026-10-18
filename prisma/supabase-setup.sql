-- Historic Broyhill — Supabase database setup
-- Run this once in the Supabase SQL Editor (Historic-Broyhill project).
-- Creates all tables (including the LinkedIn field) and the required business record.

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "referenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "designTokens" JSONB,
    "marketingTracks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadProfile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "linkedinId" TEXT,
    "companyLinkedin" TEXT,
    "city" TEXT,
    "state" TEXT,
    "enrichedAt" TIMESTAMP(3),
    "personSearchedAt" TIMESTAMP(3),
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "leadStatus" TEXT NOT NULL DEFAULT 'PROSPECT',
    "primaryTrack" TEXT NOT NULL,
    "leadSource" TEXT NOT NULL DEFAULT 'IN_PERSON_NFC',
    "estimatedValue" DOUBLE PRECISION,
    "customFields" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "scoreModifier" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiContentPipeline" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "suggestedDraft" TEXT NOT NULL,
    "mediaUrls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiContentPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadProfile_email_key" ON "LeadProfile"("email");

-- CreateIndex
CREATE INDEX "LeadProfile_businessId_idx" ON "LeadProfile"("businessId");

-- CreateIndex
CREATE INDEX "LeadProfile_email_idx" ON "LeadProfile"("email");

-- CreateIndex
CREATE INDEX "AiContentPipeline_status_idx" ON "AiContentPipeline"("status");

-- AddForeignKey
ALTER TABLE "LeadProfile" ADD CONSTRAINT "LeadProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiContentPipeline" ADD CONSTRAINT "AiContentPipeline_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the business record the capture pipeline requires (id 'broyhill-01')
INSERT INTO "BusinessProfile" ("id","businessName","industry","marketingTracks")
VALUES ('broyhill-01','Historic Broyhill','Event Venue & Class A Office Leasing',
        ARRAY['VIP','Standard Event','Office Leasing'])
ON CONFLICT ("id") DO NOTHING;

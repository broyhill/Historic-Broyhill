-- Historic Broyhill — Supabase database setup
-- Run this once in the Supabase SQL Editor (Historic-Broyhill project).
-- Creates all tables (including the LinkedIn field) and the required business record.
-- Safe to re-run: the EmailCampaign / Journey / JourneyRun section below uses IF NOT EXISTS and
-- mirrors the DDL the app itself runs on first use (lib/campaigns-db.ts, lib/journeys-db.ts).

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
    "salutation" TEXT,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
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


-- EmailCampaign (mirrors model EmailCampaign; app also creates it on first use via lib/campaigns-db.ts)
CREATE TABLE IF NOT EXISTS "EmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL DEFAULT '',
    "previewText" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT '',
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "replyTo" TEXT,
    "recipientFilter" JSONB,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "designType" TEXT NOT NULL DEFAULT 'plain',
    "body" TEXT NOT NULL DEFAULT '',
    "aiBrief" JSONB,
    "testSends" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- Journey / JourneyRun (mirror model Journey / JourneyRun; app also creates them on first use via lib/journeys-db.ts)
CREATE TABLE IF NOT EXISTS "Journey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAUSED',
    "approvalMode" TEXT NOT NULL DEFAULT 'REVIEW',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JourneyRun" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "stoppedReason" TEXT,
    "log" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JourneyRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JourneyRun_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JourneyRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "JourneyRun_status_nextRunAt_idx" ON "JourneyRun"("status", "nextRunAt");
CREATE INDEX IF NOT EXISTS "JourneyRun_leadId_idx" ON "JourneyRun"("leadId");


-- Seed the business record the capture pipeline requires (id 'broyhill-01')
INSERT INTO "BusinessProfile" ("id","businessName","industry","marketingTracks")
VALUES ('broyhill-01','Historic Broyhill','Event Venue & Class A Office Leasing',
        ARRAY['VIP','Standard Event','Office Leasing'])
ON CONFLICT ("id") DO NOTHING;

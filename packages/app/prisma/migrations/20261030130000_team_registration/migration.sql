-- Self-service team registration: an invite code per team, a flag for generated team
-- names, and a database-level guarantee of one team per person per event.

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "inviteCode" TEXT,
ADD COLUMN "usesDefaultName" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");

-- TeamMember carries its team's event so (eventId, userId) can be unique. Existing rows
-- are filled from their team. If this fails on the unique index, a person is on two
-- teams in one event and one membership needs removing by hand first.
ALTER TABLE "TeamMember" ADD COLUMN "eventId" TEXT;

UPDATE "TeamMember" m SET "eventId" = t."eventId" FROM "Team" t WHERE t."id" = m."teamId";

ALTER TABLE "TeamMember" ALTER COLUMN "eventId" SET NOT NULL;

CREATE UNIQUE INDEX "TeamMember_eventId_userId_key" ON "TeamMember"("eventId", "userId");

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

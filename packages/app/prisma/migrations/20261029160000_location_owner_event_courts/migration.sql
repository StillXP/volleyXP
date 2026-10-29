-- Locations become owned (reusable venues), and a court can belong to either a
-- location (fixed court) or a single event (temporary net at a park or beach).

-- AlterTable: owner is added nullable so existing rows can be backfilled.
ALTER TABLE "Location" ADD COLUMN "ownerId" TEXT;

-- Backfill from the earliest tournament that uses the location.
UPDATE "Location" l
SET "ownerId" = t."ownerId"
FROM (
  SELECT DISTINCT ON ("locationId") "locationId", "ownerId"
  FROM "Tournament"
  WHERE "locationId" IS NOT NULL
  ORDER BY "locationId", "createdAt"
) t
WHERE l."id" = t."locationId";

-- A location no tournament uses has no owner to assign; remove it (its courts
-- cascade, and matches pointing at those courts have courtId set to NULL).
DELETE FROM "Location" WHERE "ownerId" IS NULL;

ALTER TABLE "Location" ALTER COLUMN "ownerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Court" ADD COLUMN "eventId" TEXT,
ALTER COLUMN "locationId" DROP NOT NULL;

-- A court belongs to exactly one of a location or an event.
ALTER TABLE "Court" ADD CONSTRAINT "Court_location_xor_event_check"
  CHECK (("locationId" IS NOT NULL) <> ("eventId" IS NOT NULL));

-- CreateIndex
CREATE INDEX "Court_locationId_idx" ON "Court"("locationId");

-- CreateIndex
CREATE INDEX "Court_eventId_idx" ON "Court"("eventId");

-- CreateIndex
CREATE INDEX "Location_ownerId_idx" ON "Location"("ownerId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

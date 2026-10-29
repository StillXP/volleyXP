-- Users get a first and a last name. Better Auth still needs `name`, so it stays as the
-- display name ("First Last"); lib/auth.ts keeps the three consistent from now on.

ALTER TABLE "User" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- Split existing names: the last word becomes the last name and the rest the first name.
-- A single-word name becomes the first name, with an empty last name to fill in later.
UPDATE "User"
SET "firstName" = CASE
      WHEN position(' ' IN btrim("name")) > 0 THEN regexp_replace(btrim("name"), '\s+\S+$', '')
      ELSE btrim("name")
    END,
    "lastName" = CASE
      WHEN position(' ' IN btrim("name")) > 0 THEN substring(btrim("name") FROM '\S+$')
      ELSE ''
    END;

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

-- Opening registration or generating a bracket now moves a draft tournament forward (the
-- home page only lists tournaments that aren't drafts). This does the same for
-- tournaments whose events got there before that rule existed.
--
-- A draft tournament with an event in progress or finished is in progress; with an event
-- in registration or seeding it is in registration. Tournaments with only draft events,
-- and those already past DRAFT or cancelled, are left as they are.

UPDATE "Tournament" t
SET "status" = CASE
      WHEN EXISTS (
        SELECT 1 FROM "Event" e
        WHERE e."tournamentId" = t."id" AND e."status" IN ('IN_PROGRESS', 'COMPLETED')
      ) THEN 'IN_PROGRESS'::"TournamentStatus"
      ELSE 'REGISTRATION'::"TournamentStatus"
    END
WHERE t."status" = 'DRAFT'
  AND EXISTS (
    SELECT 1 FROM "Event" e
    WHERE e."tournamentId" = t."id"
      AND e."status" IN ('REGISTRATION', 'SEEDING', 'IN_PROGRESS', 'COMPLETED')
  );

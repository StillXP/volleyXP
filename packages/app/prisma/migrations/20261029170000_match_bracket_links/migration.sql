-- Bracket matches remember the id the Bracket component uses for them, and which
-- side of the next match a winner or loser fills, so advancing a result never has
-- to recompute the bracket.

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "bracketKey" TEXT,
ADD COLUMN "nextLoserSlot" INTEGER,
ADD COLUMN "nextWinnerSlot" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Match_stageId_bracketKey_key" ON "Match"("stageId", "bracketKey");

-- A slot is 1 or 2, and is set exactly when its next-match id is. NOT VALID checks
-- new and updated rows only, so databases that already hold matches still migrate.
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextWinner_link_check"
  CHECK (("nextWinnerMatchId" IS NULL) = ("nextWinnerSlot" IS NULL) AND ("nextWinnerSlot" IS NULL OR "nextWinnerSlot" IN (1, 2))) NOT VALID;

ALTER TABLE "Match" ADD CONSTRAINT "Match_nextLoser_link_check"
  CHECK (("nextLoserMatchId" IS NULL) = ("nextLoserSlot" IS NULL) AND ("nextLoserSlot" IS NULL OR "nextLoserSlot" IN (1, 2))) NOT VALID;

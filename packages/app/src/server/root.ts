import { router } from "./trpc";
import { tournamentRouter } from "./routers/tournament";
import { teamRouter } from "./routers/team";
import { matchRouter } from "./routers/match";
import { eventRouter } from "./routers/event";
import { stageRouter } from "./routers/stage";
import { poolRouter } from "./routers/pool";

export const appRouter = router({
  tournament: tournamentRouter,
  team: teamRouter,
  match: matchRouter,
  event: eventRouter,
  stage: stageRouter,
  pool: poolRouter,
});

export type AppRouter = typeof appRouter;

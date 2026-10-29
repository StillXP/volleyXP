import { router } from "./trpc";
import { tournamentRouter } from "./routers/tournament";
import { teamRouter } from "./routers/team";
import { matchRouter } from "./routers/match";
import { eventRouter } from "./routers/event";
import { stageRouter } from "./routers/stage";
import { poolRouter } from "./routers/pool";
import { locationRouter } from "./routers/location";
import { courtRouter } from "./routers/court";
import { registrationRouter } from "./routers/registration";

export const appRouter = router({
  tournament: tournamentRouter,
  team: teamRouter,
  match: matchRouter,
  event: eventRouter,
  stage: stageRouter,
  pool: poolRouter,
  location: locationRouter,
  court: courtRouter,
  registration: registrationRouter,
});

export type AppRouter = typeof appRouter;

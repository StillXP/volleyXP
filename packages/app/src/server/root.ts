import { router } from "./trpc";
import { tournamentRouter } from "./routers/tournament";
import { teamRouter } from "./routers/team";
import { matchRouter } from "./routers/match";

export const appRouter = router({
  tournament: tournamentRouter,
  team: teamRouter,
  match: matchRouter,
});

export type AppRouter = typeof appRouter;

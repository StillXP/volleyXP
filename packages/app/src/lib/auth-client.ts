import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

// inferAdditionalFields gives signUp and the session user the firstName and lastName
// fields declared on the server.
export const authClient = createAuthClient({ plugins: [inferAdditionalFields<typeof auth>()] });

"use client";

import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";

// Omit baseURL so the client uses the current browser origin (www, apex, or
// *.vercel.app). Hardcoding the production URL breaks sign-in on vercel.app.
export const authClient = createAuthClient({
  plugins: [
    usernameClient({ displayUsername: false }),
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        role: {
          type: "string",
        },
        mustChangePassword: {
          type: "boolean",
        },
      },
    }),
  ],
});

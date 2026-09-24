"use client";

import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";

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

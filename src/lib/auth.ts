import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink, username } from "better-auth/plugins";

import { getDb } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { deliverToCoach } from "@/lib/mail";

// Canonical production host is www — Vercel 308s apex → www.
// Keep BETTER_AUTH_URL as the www fallback for email links / auth.api calls
// that have no request host. Do not pin a static baseURL to www only: that,
// combined with Domain=.rollingsparks.org cookies, makes username/password
// sign-in silently fail on https://rollingsparksorg.vercel.app (school WiFi
// bypass when the custom domain is filtered).
const CANONICAL_PROD_URL = "https://www.rollingsparks.org";
const APEX_PROD_URL = "https://rollingsparks.org";
const VERCEL_PROD_URL = "https://rollingsparksorg.vercel.app";

const fallbackUrl =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const auth = betterAuth({
  appName: "Rolling Sparks",
  baseURL: {
    allowedHosts: [
      "www.rollingsparks.org",
      "rollingsparks.org",
      "rollingsparksorg.vercel.app",
      "*.vercel.app",
      "localhost:*",
      "127.0.0.1:*",
    ],
    protocol: "auto",
    fallback: fallbackUrl,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  // allowedHosts are also added automatically; keep explicit origins for clarity.
  trustedOrigins: [
    CANONICAL_PROD_URL,
    APEX_PROD_URL,
    VERCEL_PROD_URL,
    "https://*.vercel.app",
  ],
  advanced: {
    // Host-only cookies (no Domain=.rollingsparks.org). Apex already redirects
    // to www, and a shared parent domain breaks session cookies on *.vercel.app.
    defaultCookieAttributes: {
      sameSite: "lax",
      path: "/",
    },
  },
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 6,
    sendResetPassword: async ({ user, url }) => {
      await deliverToCoach({
        email: user.email,
        subject: "Reset your Rolling Sparks password",
        text: `Reset your Rolling Sparks password:\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "student",
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  disabledPaths: ["/is-username-available"],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }
      const secret = process.env.BETTER_AUTH_SECRET;
      const provided = ctx.headers?.get("x-internal-signup");
      if (!secret || provided !== secret) {
        throw new APIError("FORBIDDEN", {
          message: "Sign up is closed.",
        });
      }
    }),
  },
  plugins: [
    username({
      displayUsername: false,
      immutableUsername: true,
      minUsernameLength: 2,
      maxUsernameLength: 30,
    }),
    magicLink({
      disableSignUp: true,
      expiresIn: 60 * 5,
      sendMagicLink: async ({ email, url }) => {
        await deliverToCoach({
          email,
          subject: "Your Rolling Sparks sign-in link",
          text: `Sign in to Rolling Sparks:\n${url}\n\nThis link expires in 5 minutes. If you did not ask for it, you can ignore this email.`,
        });
      },
    }),
    emailOTP({
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 60 * 5,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "sign-in") {
          return;
        }
        await deliverToCoach({
          email,
          subject: "Your Rolling Sparks sign-in code",
          text: `Your Rolling Sparks sign-in code is ${otp}\n\nIt expires in 5 minutes. If you did not ask for it, you can ignore this email.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export function internalSignupHeaders() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set.");
  }
  return new Headers({ "x-internal-signup": secret });
}

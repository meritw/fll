import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink, username } from "better-auth/plugins";

import { getDb } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { deliverToCoach } from "@/lib/mail";

const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";

export const auth = betterAuth({
  appName: "Rolling Sparks",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    appUrl,
    "https://rollingsparks.org",
    "https://www.rollingsparks.org",
  ],
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
    minPasswordLength: 8,
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
      minUsernameLength: 3,
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

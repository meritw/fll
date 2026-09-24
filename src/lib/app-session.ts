import { serializeSignedCookie } from "better-call";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";

export async function appSessionCookie(userId: string) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createSession(userId);
  const cookie = ctx.authCookies.sessionToken;
  const attributes = {
    ...cookie.attributes,
    maxAge: ctx.sessionConfig.expiresIn,
  };
  const header = await serializeSignedCookie(cookie.name, created.token, ctx.secret, attributes);
  return { header, name: cookie.name, attributes };
}

export async function rememberAppSession(userId: string) {
  const cookie = await appSessionCookie(userId);
  const store = await cookies();
  const sameSite = cookie.attributes.sameSite;
  store.set(cookie.name, signedCookieValue(cookie.header), {
    httpOnly: cookie.attributes.httpOnly ?? true,
    secure: Boolean(cookie.attributes.secure),
    path: cookie.attributes.path ?? "/",
    sameSite: sameSite === "strict" || sameSite === "none" ? sameSite : "lax",
    maxAge: cookie.attributes.maxAge,
  });
}

function signedCookieValue(header: string) {
  const pair = header.split(";", 1)[0] ?? "";
  const value = pair.slice(pair.indexOf("=") + 1);
  return decodeURIComponent(value);
}

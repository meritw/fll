import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const publicPaths = ["/", "/login", "/reset-password", "/api/auth", "/api/meetings.ics"];

function isPublicPath(pathname: string) {
  if (pathname === "/") {
    return true;
  }
  return publicPaths.some(
    (path) => path !== "/" && (pathname === path || pathname.startsWith(`${path}/`)),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && !isPublic) {
    // Let API routes return JSON 401 instead of an HTML login redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged-in visitors hitting /login are handled by the login page
  // (postAuthPath → /set-password, /set-name, /meetings, or /home).

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

import { planAccess, sealSharedPlan } from "@/lib/match-plan/server";

// A sealed query is a bearer token for the team's plan.
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const pageUserId = typeof body === "object" && body !== null && "userId" in body ? body.userId : undefined;
  const access = await planAccess(pageUserId);
  switch (access.kind) {
    case "signedOut":
      return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: NO_STORE });
    case "mustFinishSetup":
      return Response.json({ error: "FINISH_SETUP" }, { status: 403, headers: NO_STORE });
    case "editor":
      return Response.json(await sealSharedPlan(), { headers: NO_STORE });
  }
}

"use client";

import { createRealtimeClient } from "@neon/realtime/client";
import { drizzleParsers } from "@neon/realtime-drizzle/client";
// @neon/realtime-react's build has no "use client" directive: import it only from client modules.
import { RealtimeProvider } from "@neon/realtime-react";
import { useState, type ReactNode } from "react";

/** Creating the client doesn't connect, so this is safe during the server render. */
export function RealtimeRoot({ url, children }: { url: string; children: ReactNode }) {
  const [client] = useState(() => createRealtimeClient({ url, parsers: { ...drizzleParsers } }));
  return <RealtimeProvider client={client}>{children}</RealtimeProvider>;
}

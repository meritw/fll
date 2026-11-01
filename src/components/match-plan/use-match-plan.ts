import type { SealedLiveQuery } from "@neon/realtime/client";
// @neon/realtime-react's build has no "use client" directive: import it only from client modules.
import { useLiveQuery } from "@neon/realtime-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { savePlanBatch } from "@/lib/actions";
import { parsePlan } from "@/lib/match-plan/plan";
import type { LivePlan, SharedPlanRow } from "@/lib/match-plan/server";
import { createPlanSync, syncStatus, type Confirmed, type PlanDispatch, type SyncStatus } from "@/lib/match-plan/sync";
import type { PlanView } from "@/lib/match-plan/view";

// Set when the server refuses this session, so renewals and the leave-page prompt stand down for the reload.
let sessionLost = false;

function leavePage() {
  sessionLost = true;
  window.location.reload();
}

function confirmedFrom(row: SharedPlanRow): Confirmed | null {
  const plan = parsePlan(row.plan);
  if (!plan) return null;
  const { version, generation, recentBatches, updatedByName } = row;
  return { plan, version, generation, recentBatches, lastEditor: updatedByName };
}

async function renew(userId: string): Promise<SealedLiveQuery<SharedPlanRow>> {
  if (sessionLost) throw new Error("Signed out");
  const response = await fetch("/api/match-plan/live", {
    method: "POST",
    cache: "no-store",
    body: JSON.stringify({ userId }),
  });
  if (response.status === 401 || response.status === 403) {
    leavePage();
    throw new Error("Signed out");
  }
  if (!response.ok) throw new Error(`Renewing the live plan failed with ${response.status}.`);
  return response.json();
}

export function useMatchPlan(live: LivePlan): Readonly<{
  view: PlanView;
  dispatch: PlanDispatch;
  status: SyncStatus;
  dismissNotice: () => void;
}> {
  const { userId } = live;
  // Every server re-render sends a new sealed query object for the same query, and a new object would
  // restart the subscription. Renewals go through refreshQuery instead.
  const [query] = useState(live.sealedQuery);
  const [initialData] = useState(() => [live.row]);
  const refreshQuery = useCallback(() => renew(userId), [userId]);
  const { data, status } = useLiveQuery(query, { initialData, refreshQuery });

  const [sync] = useState(() => {
    const confirmed = confirmedFrom(live.row);
    if (!confirmed) throw new Error("The shared match plan row is not a valid plan.");
    return createPlanSync({
      confirmed,
      save: (batch) => savePlanBatch(userId, batch),
      onSessionLost: leavePage,
      newId: () => crypto.randomUUID(),
    });
  });
  useEffect(() => () => sync.dispose(), [sync]);

  const row = data?.[0];
  useEffect(() => {
    const next = row && confirmedFrom(row);
    if (next) sync.confirm(next);
  }, [row, sync]);

  const snapshot = useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getSnapshot);

  useEffect(() => {
    if (!snapshot.unsent) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!sessionLost) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [snapshot.unsent]);

  return {
    view: snapshot.view,
    dispatch: sync.dispatch,
    status: syncStatus(status, snapshot),
    dismissNotice: sync.dismissNotice,
  };
}

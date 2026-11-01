import { cn } from "cn";

import { MATCH_SEC } from "@/lib/match-plan/plan";
import type { SyncStatus } from "@/lib/match-plan/sync";
import { formatMatchClock, type Budget, type Totals } from "@/lib/match-plan/view";

import { SyncAlert, SyncBadge } from "./sync-status";

export function MatchBar({
  totals,
  status,
  onDismissAlert,
}: {
  totals: Totals;
  status: SyncStatus;
  onDismissAlert: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background px-4 py-2">
      <div className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-2 ring-1 ring-line sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <p className="flex shrink-0 items-baseline gap-1">
            <span className="text-4xl font-bold tabular-nums">{totals.points}</span>
            <span className="text-base font-semibold text-muted-foreground">pts</span>
          </p>
          <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap sm:gap-x-6">
            <TimeUsed label="Best" budget={totals.best} />
            <TimeUsed label="Worst" budget={totals.worst} />
          </div>
        </div>
        <SyncBadge status={status} className="sm:ml-auto" />
      </div>
      <SyncAlert status={status} onDismiss={onDismissAlert} />
    </div>
  );
}

function TimeUsed({ label, budget }: { label: string; budget: Budget }) {
  return (
    <p className={cn("flex items-baseline gap-1.5 text-base whitespace-nowrap", budget.over && "text-destructive")}>
      <span className={cn("w-12 sm:w-auto", !budget.over && "text-muted-foreground")}>{label}</span>
      <span className="font-mono text-lg font-bold tabular-nums">{formatMatchClock(budget.sec)}</span>
      <span className={cn("hidden sm:inline", !budget.over && "text-muted-foreground")}>
        of {formatMatchClock(MATCH_SEC)}
      </span>
      <span aria-hidden className={cn(!budget.over && "text-muted-foreground")}>
        ·
      </span>
      <span className={cn("font-semibold", !budget.over && "text-present-ink")}>
        {formatMatchClock(Math.abs(budget.leftSec))} {budget.over ? "over" : "left"}
      </span>
    </p>
  );
}

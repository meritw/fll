import { cn } from "cn";

import { MATCH_SEC } from "@/lib/match-plan/plan";
import { formatMatchClock, type Budget, type Totals } from "@/lib/match-plan/view";

export function MatchBar({ totals }: { totals: Totals }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background px-4 py-2">
      <div className="flex items-center gap-4 rounded-2xl bg-card px-4 py-2 ring-1 ring-line sm:gap-6">
        <p className="flex shrink-0 items-baseline gap-1">
          <span className="text-4xl font-bold tabular-nums">{totals.points}</span>
          <span className="text-base font-semibold text-muted-foreground">pts</span>
        </p>
        <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap sm:gap-x-6">
          <TimeUsed label="Best" budget={totals.best} />
          <TimeUsed label="Worst" budget={totals.worst} />
        </div>
      </div>
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
        {budget.over ? `${formatMatchClock(-budget.leftSec)} over` : `${formatMatchClock(budget.leftSec)} left`}
      </span>
    </p>
  );
}

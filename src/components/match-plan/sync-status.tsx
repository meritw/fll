import { Check, CloudOff, LoaderCircle, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { SyncStatus } from "@/lib/match-plan/sync";

type Badge = Readonly<{ label: string; Icon: LucideIcon; spin?: boolean; trouble?: boolean }>;

const BADGES: { readonly [S in SyncStatus["state"]]: Badge } = {
  connecting: { label: "Connecting…", Icon: LoaderCircle, spin: true },
  saving: { label: "Saving…", Icon: LoaderCircle, spin: true },
  saved: { label: "Saved", Icon: Check },
  reconnecting: { label: "Reconnecting…", Icon: RefreshCw, spin: true },
  offline: { label: "Offline", Icon: CloudOff, trouble: true },
  stopped: { label: "Live updates stopped", Icon: TriangleAlert, trouble: true },
};

export function SyncBadge({ status, className }: { status: SyncStatus; className?: string }) {
  const { label, Icon, spin, trouble } = BADGES[status.state];
  return (
    <p
      role="status"
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-base",
        trouble ? "font-semibold text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", spin && "animate-spin", status.state === "saved" && "text-present")}
        aria-hidden
      />
      <span>
        {label}
        {status.state === "saved" && status.lastEditor ? ` · Last change by ${status.lastEditor}` : null}
      </span>
    </p>
  );
}

type Alert = NonNullable<SyncStatus["alert"]>;

const ALERTS: { readonly [K in Alert["kind"]]: Readonly<{ text: string; dismissable: boolean; trouble: boolean }> } = {
  offline: {
    text: "Can't save right now. Your edits stay on this page and save when you're back online.",
    dismissable: false,
    trouble: true,
  },
  stopped: { text: "Live updates stopped. Reload to see the team's latest plan.", dismissable: false, trouble: true },
  dropped: { text: "A change couldn't be saved. Reload to see the team's latest plan.", dismissable: true, trouble: true },
  reset: { text: "A coach reset the plan to the sample.", dismissable: true, trouble: false },
};

export function SyncAlert({ status, onDismiss }: { status: SyncStatus; onDismiss: () => void }) {
  const { alert } = status;
  if (!alert) return null;
  const { text, dismissable, trouble } = ALERTS[alert.kind];
  const reload = alert.kind === "offline" ? alert.canReload : alert.kind !== "reset";
  return (
    <div
      role="alert"
      className={cn(
        "mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-2 text-base",
        trouble ? "bg-destructive/10 text-destructive" : "bg-card ring-1 ring-line",
      )}
    >
      <p className="min-w-0 flex-1 basis-56">
        {text}
        {alert.kind === "offline" && reload ? " Reloading drops edits that haven't saved." : null}
      </p>
      <div className="flex gap-2">
        {reload ? (
          <Button variant="outline" className="h-11 px-4 text-base" onClick={() => window.location.reload()}>
            Reload
          </Button>
        ) : null}
        {dismissable ? (
          <Button variant="ghost" className="h-11 px-4 text-base" onClick={onDismiss}>
            OK
          </Button>
        ) : null}
      </div>
    </div>
  );
}

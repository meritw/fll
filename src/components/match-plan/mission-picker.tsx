import { Button } from "@/components/ui/button";
import type { MissionCode } from "@/lib/match-plan/plan";
import type { RunView } from "@/lib/match-plan/view";
import { missionCode } from "@/lib/mission-status";
import { MISSIONS } from "@/lib/missions";

export function MissionPicker({
  runs,
  onPick,
  onClose,
}: {
  runs: RunView[];
  onPick: (code: MissionCode) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-semibold">Pick a mission</p>
        <Button variant="ghost" className="h-11 px-3 text-base" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MISSIONS.map(([code, name]) => {
          const plannedIn = runs.filter((view) => view.run.missions.some((mission) => mission.code === code));
          return (
            <li key={code}>
              <button
                type="button"
                onClick={() => onPick(code)}
                className="flex size-full min-h-14 flex-col items-start gap-0.5 rounded-xl bg-card px-3 py-2 text-left ring-1 ring-line hover:bg-muted"
              >
                <span className="font-mono text-sm text-muted-foreground">{missionCode(code)}</span>
                <span className="text-base leading-tight font-semibold">{name}</span>
                {plannedIn.length > 0 ? (
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs font-semibold text-muted-foreground">
                    {plannedIn.map((view) => (
                      <span key={view.run.id} className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: view.color }} aria-hidden />
                        In Run {view.number}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

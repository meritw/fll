import { TeamLockup } from "@/components/team-logo";

/**
 * Sign-in and account-setup frame: the white wolf on a panel of the team's
 * tie-dye shirt, with the form on plain paper beside it (above it on phones).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="tie-dye tie-dye-drift flex flex-col items-center justify-center gap-5 px-6 py-8 text-white sm:py-10 lg:py-16">
        <TeamLockup
          ink="white"
          className="h-32 w-auto drop-shadow-[0_2px_10px_rgb(43_14_22/0.35)] sm:h-40 lg:h-64"
          priority
        />
        <p className="hidden font-mono text-sm tracking-[0.08em] text-white/80 uppercase lg:block">
          FIRST LEGO League Challenge · Team 55900
        </p>
      </aside>
      <main className="flex flex-1 flex-col justify-center px-4 py-10 lg:py-16">
        <div className="mx-auto w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}

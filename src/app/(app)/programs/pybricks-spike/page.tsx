import type { Metadata } from "next";
import Link from "next/link";

import { PybricksSpikeEmbed } from "@/components/pybricks-spike-embed";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pybricks spike (experimental)",
};

/**
 * Draft / experimental — Option D from the Pybricks iframe feasibility spike.
 * Requires `scripts/build-pybricks.sh` so `public/pybricks` exists.
 */
export default function PybricksSpikePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Experimental · draft spike · do not ship to kids yet
          </p>
          <h1 className="text-3xl font-semibold">Pybricks self-host (Option D)</h1>
          <p className="max-w-2xl text-muted-foreground">
            Same-origin build of MIT{" "}
            <a
              className="underline underline-offset-4"
              href="https://github.com/pybricks/pybricks-code"
              target="_blank"
              rel="noreferrer"
            >
              pybricks/pybricks-code
            </a>{" "}
            under <code>/pybricks/</code>, with a minimal postMessage backup bridge.
            Not Neon auto-save — only proves we can pull a zip into Rolling Sparks.
          </p>
        </div>
        <Button asChild variant="outline" size="xl">
          <Link href="/programs">Back to programs</Link>
        </Button>
      </div>
      <PybricksSpikeEmbed />
    </div>
  );
}

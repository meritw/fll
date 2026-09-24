import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProgramForm } from "@/components/program-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatWhen } from "@/lib/format";
import { getProgram, listMissions } from "@/lib/programs";

export const metadata: Metadata = {
  title: "Program",
};

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [program, missions] = await Promise.all([getProgram(id), listMissions()]);
  if (!program) {
    notFound();
  }

  const [latest, ...older] = program.versions;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/programs" className="text-base underline-offset-4 hover:underline">
          All programs
        </Link>
        <h1 className="text-3xl font-semibold">{program.name}</h1>
      </div>

      {latest ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Latest version</h2>
          <VersionDetails version={latest} />
          <Button asChild size="xl">
            <a href={`/versions/${latest.id}/download`}>Download</a>
          </Button>
        </section>
      ) : (
        <p>This program has no versions yet.</p>
      )}

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Older versions</h2>
        {older.length === 0 ? (
          <p>No older versions.</p>
        ) : (
          <ol className="flex flex-col gap-6">
            {older.map((version) => (
              <li key={version.id} className="flex flex-col gap-3 border-b pb-6">
                <VersionDetails version={version} />
                <Button asChild size="xl" variant="secondary">
                  <a href={`/versions/${version.id}/download`}>Download</a>
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Upload a new version</h2>
        <ProgramForm
          mode="version"
          programId={program.id}
          defaultName={program.name}
          defaultMissionIds={latest?.missionIds ?? []}
          missions={missions}
        />
      </section>
    </div>
  );
}

function VersionDetails({
  version,
}: {
  version: {
    versionNumber: number;
    createdAt: Date;
    uploadedByName: string;
    note: string;
    missions: { number: number; name: string }[];
  };
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xl font-medium">Version {version.versionNumber}</p>
      <p>
        {formatWhen(version.createdAt)} · {version.uploadedByName}
      </p>
      <p>{version.note}</p>
      <div className="flex flex-wrap gap-2">
        {version.missions.length === 0 ? (
          <span className="text-muted-foreground">No missions</span>
        ) : (
          version.missions.map((mission) => (
            <Badge key={mission.number} variant="secondary" className="h-auto px-3 py-1 text-base">
              {mission.number} {mission.name}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { UploadVersionDialog } from "@/components/upload-version-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMissions, listPrograms } from "@/lib/programs";

export const metadata: Metadata = {
  title: "Programs",
};

export default async function ProgramsPage() {
  const [programs, missions] = await Promise.all([listPrograms(), listMissions()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Programs</h1>
        <Button asChild size="xl">
          <Link href="/programs/new">Add a program</Link>
        </Button>
      </div>
      {programs.length === 0 ? (
        <p>No programs yet. Add the first one.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {programs.map((item) => (
            <Card key={item.id} className="text-lg">
              <CardHeader>
                <CardTitle className="text-2xl">
                  <Link href={`/programs/${item.id}`} className="underline-offset-4 hover:underline">
                    {item.name}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {item.missions.length === 0 ? (
                    <span className="text-muted-foreground">No missions on the latest version</span>
                  ) : (
                    item.missions.map((mission) => (
                      <Badge
                        key={mission.number}
                        variant="secondary"
                        className="h-auto px-3 py-1 text-base"
                      >
                        {mission.number} {mission.name}
                      </Badge>
                    ))
                  )}
                </div>
                <p>
                  {item.versionCount} {item.versionCount === 1 ? "version" : "versions"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {item.latestVersionId ? (
                    <Button asChild size="xl">
                      <a href={`/versions/${item.latestVersionId}/download`}>Download</a>
                    </Button>
                  ) : null}
                  <UploadVersionDialog
                    programId={item.id}
                    programName={item.name}
                    defaultMissionIds={item.latestMissionIds}
                    missions={missions}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

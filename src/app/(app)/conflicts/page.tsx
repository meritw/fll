import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCoach } from "@/lib/session";
import { listOpenConflicts } from "@/lib/team-project";

export const metadata: Metadata = {
  title: "Conflicts",
};

export default async function ConflictsPage() {
  await requireCoach();
  const conflicts = await listOpenConflicts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Merge conflicts</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Kids uploaded overlapping edits. Pick team version, their upload, or a fixed zip.
          </p>
        </div>
        <Button asChild size="xl" variant="outline">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>

      {conflicts.length === 0 ? (
        <p className="text-lg">No open conflicts. Nice.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {conflicts.map((item) => (
            <Card key={item.id} className="text-lg">
              <CardHeader>
                <CardTitle className="text-xl">
                  <code className="text-base">{item.path}</code>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p>
                  From <span className="font-medium">{item.uploadedByName}</span>
                  {item.uploadMessage ? ` · ${item.uploadMessage}` : null}
                  {" · "}
                  {item.kind}
                </p>
                <div>
                  <Button asChild size="xl">
                    <Link href={`/conflicts/${item.id}`}>Review</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

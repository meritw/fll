import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConflictResolveForm } from "@/components/conflict-resolve-form";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/session";
import { getConflict } from "@/lib/team-project";

export const metadata: Metadata = {
  title: "Resolve conflict",
};

export default async function ConflictDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCoach();
  const { id } = await params;
  const conflict = await getConflict(id);
  if (!conflict) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Resolve conflict</h1>
          <p className="mt-2 text-lg">
            <code>{conflict.path}</code> · {conflict.kind}
          </p>
          <p className="mt-1 text-muted-foreground">
            Upload by {conflict.uploadedBy.name}
            {conflict.upload.message ? ` · ${conflict.upload.message}` : null}
          </p>
        </div>
        <Button asChild size="xl" variant="outline">
          <Link href="/conflicts">All conflicts</Link>
        </Button>
      </div>

      {conflict.kind === "text" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Side title="Base (shared start)" body={conflict.baseContent} />
          <Side title="Team (current)" body={conflict.oursContent} />
          <Side title="Upload" body={conflict.theirsContent} />
        </div>
      ) : (
        <p className="text-muted-foreground">
          Binary conflict — contents are stored as blobs. Choose team or upload, or replace the
          whole project zip.
        </p>
      )}

      <ConflictResolveForm
        conflict={{
          id: conflict.id,
          path: conflict.path,
          kind: conflict.kind,
          oursContent: conflict.oursContent,
          theirsContent: conflict.theirsContent,
          baseContent: conflict.baseContent,
          uploadedByName: conflict.uploadedBy.name,
          uploadMessage: conflict.upload.message,
        }}
      />
    </div>
  );
}

function Side({ title, body }: { title: string; body: string | null }) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
        {body ?? "(missing / deleted)"}
      </pre>
    </div>
  );
}

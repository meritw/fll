import type { Metadata } from "next";

import { GalleryGrid } from "@/components/gallery-grid";
import { listGalleryMedia } from "@/lib/media";
import { requireUser } from "@/lib/session";
import { formatTeamDay, formatTeamStamp, TEAM_TIME_ZONE_ABBR } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Gallery",
};

export default async function GalleryPage() {
  await requireUser();
  const items = await listGalleryMedia(120);
  const stamp = (value: Date) => `${formatTeamStamp(value)} ${TEAM_TIME_ZONE_ABBR}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Gallery</h1>
        <p className="text-lg text-muted-foreground">
          Photos and videos from team sessions, newest first. Add more from the journal.
        </p>
      </div>

      <GalleryGrid
        items={items.map((item) => ({
          id: item.id,
          meetingId: item.meetingId,
          contentType: item.contentType,
          caption: item.caption,
          uploaderName: item.uploaderName,
          createdLabel: stamp(item.createdAt),
          sessionLabel:
            item.sessionNumber != null
              ? `Session ${item.sessionNumber}`
              : item.sessionTitle?.trim() || "Session",
          sessionDay: formatTeamDay(item.sessionStartsAt),
        }))}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { GalleryGrid } from "@/components/gallery-grid";
import { countMedia, listGalleryMedia } from "@/lib/media";
import { requireUser } from "@/lib/session";
import { formatTeamDay, formatTeamStamp, TEAM_TIME_ZONE_ABBR } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Gallery",
};

/** Keep each page small so iOS Safari is not handed dozens of full-res media at once. */
const PAGE_SIZE = 24;

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function GalleryPage({ searchParams }: PageProps) {
  await requireUser();
  const { page: pageParam } = await searchParams;
  const requested = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const total = await countMedia();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = await listGalleryMedia(PAGE_SIZE, (safePage - 1) * PAGE_SIZE);

  const stamp = (value: Date) => `${formatTeamStamp(value)} ${TEAM_TIME_ZONE_ABBR}`;
  const from = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Gallery</h1>
        <p className="text-lg text-muted-foreground">
          Photos and videos from team sessions, newest first. Add more from the journal.
        </p>
        {total > 0 ? (
          <p className="text-base text-muted-foreground">
            Showing {from}–{to} of {total}
          </p>
        ) : null}
      </div>

      <GalleryGrid
        items={pageItems.map((item) => ({
          id: item.id,
          meetingId: item.meetingId,
          fromHome: item.fromHome,
          contentType: item.contentType,
          caption: item.caption,
          uploaderName: item.uploaderName,
          createdLabel: stamp(item.createdAt),
          sessionLabel: item.fromHome
            ? "From home"
            : item.sessionNumber != null
              ? `Session ${item.sessionNumber}`
              : item.sessionTitle?.trim() || "Session",
          sessionDay: item.sessionStartsAt
            ? formatTeamDay(item.sessionStartsAt)
            : formatTeamDay(item.createdAt),
        }))}
      />

      {totalPages > 1 ? (
        <nav
          aria-label="Gallery pages"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
        >
          {safePage > 1 ? (
            <Link
              href={safePage === 2 ? "/gallery" : `/gallery?page=${safePage - 1}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-muted px-4 text-base font-semibold hover:bg-foreground/10"
            >
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-base text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          {safePage < totalPages ? (
            <Link
              href={`/gallery?page=${safePage + 1}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-muted px-4 text-base font-semibold hover:bg-foreground/10"
            >
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

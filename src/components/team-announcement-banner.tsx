const CHECKUP_URL =
  "https://claude.ai/artifact/WKr5xFDdnvWqpMpwwdPQUG#be268add-b417.mw1xwzfxe8t.4528";

/** Sitewide note for every signed-in user (kids, coaches, parents). */
export function TeamAnnouncementBanner() {
  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50"
    >
      <p className="mx-auto max-w-6xl px-4 py-2.5 text-center text-sm font-medium sm:text-base">
        Attention Rolling Sparks! See the{" "}
        <a
          href={CHECKUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-100"
        >
          Rolling Sparks Robot Checkup document
        </a>{" "}
        for code updates
      </p>
    </div>
  );
}

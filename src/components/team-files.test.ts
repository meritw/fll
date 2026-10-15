import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { highlightLines } from "@/lib/highlight";

import { TeamFiles } from "./team-files";

describe("TeamFiles", () => {
  it("shows the upload note as the version name and colors Python", async () => {
    const highlighted = await highlightLines("from pybricks.hubs import PrimeHub\n", "python");
    const html = renderToStaticMarkup(
      createElement(TeamFiles, {
        notes: ["This is the starter code. It changes after the first upload."],
        chips: [
          { href: "/home/files", current: false, title: "Now", detail: null, caption: null },
          {
            href: "/home/files?sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            current: true,
            title: "Fixed the turn",
            detail: "Ava · Oct 1, 2026, 11:00 AM",
            caption: "aaaaaaa",
          },
        ],
        olderHref: null,
        banner: {
          text: "You are looking at an older version from Oct 1, 2026, 11:00 AM by Ava. Fixed the turn",
          latestHref: "/home/files?file=main.py",
        },
        rows: [
          { path: "main.py", href: "/home/files?file=main.py", current: true, note: null },
          { path: "lib/arm.py", href: "/home/files?file=lib/arm.py", current: false, note: "Changed" },
        ],
        selectedPath: "main.py",
        lines: highlighted.map((line, index) => ({ no: index + 1, html: line, mark: "plain" as const })),
        codeNote: null,
        binaryPath: null,
        tooBig: false,
        changesHref: "/home/files?file=main.py&view=changes",
        codeHref: null,
      }),
    );

    assert.match(html, /Fixed the turn[\s\S]*aaaaaaa/);
    assert.match(html, /Go to latest/);
    assert.match(html, /Show what changed/);
    assert.match(html, /lib\/arm\.py/);
    assert.match(html, /--shiki-light:#D73A49/);
    assert.match(html, /id="L1"/);
  });
});

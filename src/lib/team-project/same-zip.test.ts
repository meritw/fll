import assert from "node:assert/strict";
import { describe, it } from "node:test";

import JSZip from "jszip";

import { unzipProjectArchive, zipProjectFiles } from "./fs";
import {
  downloadZipComment,
  hasDownloadComment,
  hasDownloadName,
  isUnchangedTeamDownload,
} from "./same-zip";

const encode = (text: string) => new TextEncoder().encode(text);
const tree = (entries: Record<string, string>) =>
  new Map(Object.entries(entries).map(([path, text]) => [path, encode(text)]));

describe("hasDownloadName", () => {
  it("matches every way the browser names our download", () => {
    assert.equal(hasDownloadName("RollingSparks.zip"), true);
    assert.equal(hasDownloadName("RollingSparks (2).zip"), true);
    assert.equal(hasDownloadName("rollingsparks-git.zip"), true);
    assert.equal(hasDownloadName("C:\\Users\\kid\\Downloads\\RollingSparks (1).zip"), true);
  });

  it("does not match a Pybricks backup", () => {
    assert.equal(hasDownloadName("pybricks-backup-2026-10-18T19_02_11.zip"), false);
    assert.equal(hasDownloadName("pybricks-backup (1).zip"), false);
  });
});

describe("download zip comment", () => {
  it("survives a zip round trip", async () => {
    const files = tree({ "main.py": "print(1)\n" });
    const bytes = await zipProjectFiles(files, { comment: downloadZipComment("abc123") });
    const { files: back, comment } = await unzipProjectArchive(bytes);
    assert.equal(hasDownloadComment(comment), true);
    assert.equal(new TextDecoder().decode(back.get("main.py")), "print(1)\n");
  });

  it("is missing from a zip rebuilt without it, like a Pybricks backup", async () => {
    const zip = new JSZip();
    zip.file("main.py", "print(1)\n");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const { comment } = await unzipProjectArchive(bytes);
    assert.equal(hasDownloadComment(comment), false);
  });
});

describe("isUnchangedTeamDownload", () => {
  const head = tree({ "main.py": "print(1)\n", "drive.py": "go()\n" });

  it("flags our download uploaded back unchanged", () => {
    assert.equal(
      isUnchangedTeamDownload({
        fileName: "RollingSparks.zip",
        zipComment: downloadZipComment("abc"),
        files: new Map(head),
        downloadedTrees: [head],
      }),
      true,
    );
  });

  it("flags a renamed download by its comment", () => {
    assert.equal(
      isUnchangedTeamDownload({
        fileName: "my robot.zip",
        zipComment: downloadZipComment("abc"),
        files: new Map(head),
        downloadedTrees: [head],
      }),
      true,
    );
  });

  it("flags an older download (no comment) by its name", () => {
    assert.equal(
      isUnchangedTeamDownload({
        fileName: "RollingSparks (3).zip",
        zipComment: null,
        files: new Map(head),
        downloadedTrees: [tree({ "main.py": "old\n" }), head],
      }),
      true,
    );
  });

  it("lets a Pybricks backup with no edits through", () => {
    assert.equal(
      isUnchangedTeamDownload({
        fileName: "pybricks-backup-2026-10-18.zip",
        zipComment: null,
        files: new Map(head),
        downloadedTrees: [head],
      }),
      false,
    );
  });

  it("lets a RollingSparks zip with real changes through", () => {
    assert.equal(
      isUnchangedTeamDownload({
        fileName: "RollingSparks.zip",
        zipComment: downloadZipComment("abc"),
        files: tree({ "main.py": "print(2)\n", "drive.py": "go()\n" }),
        downloadedTrees: [head],
      }),
      false,
    );
  });

  it("treats an added or removed file as a change", () => {
    assert.equal(
      isUnchangedTeamDownload({
        fileName: "RollingSparks.zip",
        files: tree({ "main.py": "print(1)\n" }),
        downloadedTrees: [head],
      }),
      false,
    );
  });
});

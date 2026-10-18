import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyBrowseBytes,
  diffBrowseRows,
  filesAtRev,
  isSafeBrowsePath,
  listChangedPaths,
  pageBrowseCommits,
  parseBrowseQuery,
  sortBrowsePaths,
  toBrowseSnapshot,
  type BrowseCommit,
} from "./browse";
import { browseHref } from "./browse-url";
import { createMemFs, initRepo, REPO_DIR, stageAllAndCommit } from "./fs";
import { readDownloadTree } from "./index";

const text = (value: string) => new TextEncoder().encode(value);
const decode = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

const sha = (digit: string) => digit.repeat(40);

function commit(digit: string, message: string): BrowseCommit {
  return {
    sha: sha(digit),
    parentSha: null,
    message,
    createdAt: new Date(`2026-10-0${digit}T15:00:00.000Z`),
    uploaderName: "Ava",
  };
}

describe("browseHref", () => {
  it("builds the files URL from the file, sha, and change view", () => {
    assert.equal(browseHref({}), "/home/files");
    assert.equal(
      browseHref({ file: "main.py", sha: sha("a"), changes: true }),
      `/home/files?file=main.py&sha=${sha("a")}&view=changes`,
    );
  });
});

describe("classifyBrowseBytes", () => {
  it("marks Python, plain text, and binary files", () => {
    assert.equal(classifyBrowseBytes("main.py", text("print(1)\n")), "python");
    assert.equal(classifyBrowseBytes("notes.txt", text("hello")), "text");
    assert.equal(classifyBrowseBytes("lib/arm.py", text("")), "python");
    assert.equal(classifyBrowseBytes("hub.bin", new Uint8Array([0, 1, 2])), "binary");
    assert.equal(classifyBrowseBytes("weird.py", new Uint8Array([0])), "binary");
  });
});

describe("isSafeBrowsePath", () => {
  it("keeps a project path and rejects escapes", () => {
    assert.equal(isSafeBrowsePath("lib/arm.py"), true);
    assert.equal(isSafeBrowsePath("../main.py"), false);
    assert.equal(isSafeBrowsePath("/main.py"), false);
    assert.equal(isSafeBrowsePath(".git/config"), false);
    assert.equal(isSafeBrowsePath("lib\\arm.py"), false);
  });
});

describe("parseBrowseQuery", () => {
  it("treats a missing sha as now and a short sha as rejected", () => {
    const open = parseBrowseQuery({ file: "main.py" });
    assert.equal(open.rev, "now");
    assert.equal(open.file, "main.py");
    assert.equal(open.shaRejected, false);
    assert.equal(open.changes, false);

    const bad = parseBrowseQuery({ sha: "abc1234", view: "changes", file: "../x.py" });
    assert.equal(bad.rev, "now");
    assert.equal(bad.shaRejected, true);
    assert.equal(bad.file, null);
    assert.equal(bad.fileRejected, true);
    assert.equal(bad.changes, false);
  });

  it("accepts a full sha and turns on the change view", () => {
    const query = parseBrowseQuery({
      sha: sha("a").toUpperCase(),
      file: ["drive.py"],
      view: "changes",
      before: sha("b"),
    });
    assert.deepEqual(query.rev, { sha: sha("a") });
    assert.equal(query.file, "drive.py");
    assert.equal(query.changes, true);
    assert.equal(query.before, sha("b"));
  });
});

describe("sortBrowsePaths", () => {
  it("puts main.py first, then other Python files", () => {
    assert.deepEqual(sortBrowsePaths(["notes.txt", "b.py", "main.py", "a.py"]), [
      "main.py",
      "a.py",
      "b.py",
      "notes.txt",
    ]);
  });
});

describe("diffBrowseRows", () => {
  it("marks the replaced line and keeps the lines around it", () => {
    assert.deepEqual(diffBrowseRows("a\nb\nc\n", "a\nB\nc\n"), [
      { kind: "same", oldNo: 1, newNo: 1 },
      { kind: "del", oldNo: 2 },
      { kind: "add", newNo: 2 },
      { kind: "same", oldNo: 3, newNo: 3 },
    ]);
  });
});

describe("listChangedPaths", () => {
  it("reports added, changed, and removed paths", () => {
    const before = new Map<string, Uint8Array>([
      ["main.py", text("one\n")],
      ["old.txt", text("gone\n")],
    ]);
    const after = new Map<string, Uint8Array>([
      ["main.py", text("two\n")],
      ["new.py", text("hi\n")],
    ]);
    assert.deepEqual(listChangedPaths(before, after), [
      { path: "main.py", kind: "changed" },
      { path: "new.py", kind: "added" },
      { path: "old.txt", kind: "removed" },
    ]);
  });
});

describe("pageBrowseCommits", () => {
  it("returns every commit when no limit is set", () => {
    const commits = [commit("1", "newest"), commit("2", "middle"), commit("3", "oldest")];
    const all = pageBrowseCommits(commits);
    assert.deepEqual(
      all.commits.map((item) => item.message),
      ["newest", "middle", "oldest"],
    );
    assert.equal(all.nextBefore, null);
  });

  it("pages older than the last sha already shown", () => {
    const commits = [commit("1", "newest"), commit("2", "middle"), commit("3", "oldest")];
    const first = pageBrowseCommits(commits, { limit: 2 });
    assert.deepEqual(
      first.commits.map((item) => item.message),
      ["newest", "middle"],
    );
    assert.equal(first.nextBefore, sha("2"));
    const second = pageBrowseCommits(commits, { limit: 2, before: first.nextBefore });
    assert.deepEqual(
      second.commits.map((item) => item.message),
      ["oldest"],
    );
    assert.equal(second.nextBefore, null);
  });
});

describe("filesAtRev", () => {
  it("reads now from the working tree and an older sha from that commit", async () => {
    const { fs } = createMemFs();
    await initRepo(fs);
    await fs.promises.writeFile(`${REPO_DIR}/main.py`, "print(1)\n");
    const saved = await stageAllAndCommit({
      fs,
      message: "first",
      name: "Ava",
      email: "ava@students.local",
    });
    await fs.promises.writeFile(`${REPO_DIR}/main.py`, "print(2)\n");
    const now = await readDownloadTree({ fs, dir: REPO_DIR, headSha: saved });
    const nowFiles = await filesAtRev({
      fs,
      dir: REPO_DIR,
      rev: "now",
      nowFiles: now.files,
    });
    const oldFiles = await filesAtRev({
      fs,
      dir: REPO_DIR,
      rev: { sha: saved },
      nowFiles: now.files,
    });
    assert.equal(decode(nowFiles?.get("main.py")), "print(2)\n");
    assert.equal(decode(oldFiles?.get("main.py")), "print(1)\n");

    const snapshot = toBrowseSnapshot({
      rev: "now",
      headSha: saved,
      starter: now.starter,
      files: now.files,
    });
    assert.equal(snapshot.files.get("main.py")?.kind, "python");
    assert.equal(snapshot.starter, false);
  });
});

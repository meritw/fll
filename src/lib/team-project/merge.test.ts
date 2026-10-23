import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeOneFile, mergeTrees } from "./merge";

const enc = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array | undefined) =>
  bytes ? new TextDecoder().decode(bytes) : undefined;

function tree(entries: Record<string, string>) {
  return new Map(Object.entries(entries).map(([path, text]) => [path, enc(text)]));
}

describe("mergeTrees overlay (partial zip)", () => {
  it("zip missing a path keeps that path from HEAD", () => {
    const base = tree({
      "main.py": "print('base')\n",
      "mission_a.py": "print('a')\n",
      "mission_b.py": "print('b')\n",
    });
    const ours = tree({
      "main.py": "print('base')\n",
      "mission_a.py": "print('a teammate')\n",
      "mission_b.py": "print('b')\n",
    });
    // Student only backed up / edited main.py — other files omitted from zip.
    const theirs = tree({
      "main.py": "print('my main')\n",
    });

    const { result, conflicts } = mergeTrees(base, ours, theirs);

    assert.equal(conflicts.length, 0);
    assert.equal(decode(result.get("main.py")), "print('my main')\n");
    assert.equal(decode(result.get("mission_a.py")), "print('a teammate')\n");
    assert.equal(decode(result.get("mission_b.py")), "print('b')\n");
    assert.equal(result.size, 3);
  });

  it("full zip that includes every path still updates and can replace content", () => {
    const base = tree({
      "main.py": "print('base')\n",
      "other.py": "print('other')\n",
    });
    const ours = new Map(base);
    const theirs = tree({
      "main.py": "print('new main')\n",
      "other.py": "print('new other')\n",
    });

    const { result, conflicts } = mergeTrees(base, ours, theirs);

    assert.equal(conflicts.length, 0);
    assert.equal(decode(result.get("main.py")), "print('new main')\n");
    assert.equal(decode(result.get("other.py")), "print('new other')\n");
  });

  it("zip with only a new file adds it and leaves existing HEAD files", () => {
    const base = tree({ "main.py": "print(1)\n" });
    const ours = tree({ "main.py": "print(1)\n", "kept.py": "print('keep')\n" });
    const theirs = tree({ "new.py": "print('new')\n" });

    const { result, conflicts } = mergeTrees(base, ours, theirs);

    assert.equal(conflicts.length, 0);
    assert.equal(decode(result.get("main.py")), "print(1)\n");
    assert.equal(decode(result.get("kept.py")), "print('keep')\n");
    assert.equal(decode(result.get("new.py")), "print('new')\n");
  });

  it("empty theirs map (no file entries) keeps the entire HEAD tree", () => {
    const ours = tree({
      "main.py": "print(1)\n",
      "lib/helper.py": "x = 1\n",
    });
    const { result, conflicts } = mergeTrees(ours, ours, new Map());

    assert.equal(conflicts.length, 0);
    assert.equal(result.size, 2);
    assert.equal(decode(result.get("main.py")), "print(1)\n");
    assert.equal(decode(result.get("lib/helper.py")), "x = 1\n");
  });

  it("still conflicts when both sides edited the same path differently", () => {
    const base = tree({ "main.py": "print('base')\n" });
    const ours = tree({ "main.py": "print('ours')\n" });
    const theirs = tree({ "main.py": "print('theirs')\n" });

    const { result, conflicts } = mergeTrees(base, ours, theirs);

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.path, "main.py");
    assert.equal(result.has("main.py"), false);
  });
});

describe("mergeOneFile", () => {
  it("takes theirs when only the upload changed the file", () => {
    const base = enc("a\n");
    const ours = enc("a\n");
    const theirs = enc("b\n");
    const merged = mergeOneFile("main.py", base, ours, theirs);
    if (merged.status === "conflict") {
      assert.fail("expected auto merge, got conflict");
    }
    assert.equal(merged.status, "auto");
    assert.equal(decode(merged.content ?? undefined), "b\n");
  });
});

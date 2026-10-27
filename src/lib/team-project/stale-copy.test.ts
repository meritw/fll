import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMemFs,
  initRepo,
  listCommitOids,
  readBlobAt,
  REPO_DIR,
  stageAllAndCommit,
  treeAtCommit,
} from "./fs";
import {
  bytesEqual,
  collectOlderBodies,
  commitPlannedTrees,
  findStaleCopies,
  planUpload,
  programBody,
  snapshotCommitMessage,
} from "./stale-copy";

const enc = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array | null | undefined) =>
  bytes ? new TextDecoder().decode(bytes) : "";

function blocksFile(version: string, scrollX: number, program: string) {
  const header = {
    blocks: { languageVersion: 0, blocks: [{ type: "blockPrint", id: "a", fields: { TEXT: program } }] },
    info: { type: "pybricks", version },
    workspaceOptions: { scrollX, scrollY: 10, scale: 1 },
  };
  return enc(`# pybricks blocks file:${JSON.stringify(header)}\n${program}\n`);
}

async function commitFiles(
  fs: Awaited<ReturnType<typeof createMemFs>>["fs"],
  files: Record<string, string | Uint8Array>,
  message: string,
) {
  for (const [path, data] of Object.entries(files)) {
    const full = `${REPO_DIR}/${path}`;
    const parent = full.slice(0, full.lastIndexOf("/"));
    if (parent && parent !== REPO_DIR) {
      await fs.promises.mkdir(parent, { recursive: true });
    }
    const bytes = typeof data === "string" ? data : Buffer.from(data);
    await fs.promises.writeFile(full, bytes);
  }
  return stageAllAndCommit({
    fs,
    message,
    name: "Joe",
    email: "joe@students.local",
  });
}

async function historyHas(fs: Awaited<ReturnType<typeof createMemFs>>["fs"], head: string, path: string, bytes: Uint8Array) {
  const oids = await listCommitOids(fs, REPO_DIR, head);
  for (const oid of oids) {
    const blob = await readBlobAt(fs, REPO_DIR, oid, path);
    if (bytesEqual(blob, bytes)) {
      return true;
    }
  }
  return false;
}

describe("programBody", () => {
  it("treats a Pybricks version or scroll change as the same program", () => {
    const tip = blocksFile("2.1.1", 225, "print('leaf')");
    const opened = blocksFile("2.0.0", 10, "print('leaf')");
    assert.equal(programBody(opened), programBody(tip));
    assert.equal(bytesEqual(opened, tip), false);
  });
});

describe("older copy upload", () => {
  async function tipWithOlderMenu() {
    const { fs } = createMemFs();
    await initRepo(fs);
    const oldMenu = "print('old menu')\n";
    const newMenu = "print('new menu')\n";
    await commitFiles(fs, { "menu.py": oldMenu, "main.py": "print('hi')\n" }, "starter menu");
    const head = await commitFiles(fs, { "menu.py": newMenu }, "real menu");
    const ours = await treeAtCommit(fs, REPO_DIR, head);
    return { fs, head, ours, oldMenu: enc(oldMenu), newMenu: enc(newMenu) };
  }

  it("warns when the upload matches an older blob", async () => {
    const { fs, head, ours, oldMenu } = await tipWithOlderMenu();
    const theirs = new Map(ours);
    theirs.set("menu.py", oldMenu);
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, ["menu.py"]);
    const planned = planUpload({
      base: ours,
      ours,
      theirs,
      olderBodies,
      staleChoice: null,
    });
    assert.equal(planned.needsChoice, true);
    if (planned.needsChoice) {
      assert.deepEqual(planned.paths, ["menu.py"]);
    }
  });

  it("does not warn for a new file", async () => {
    const { fs, head, ours } = await tipWithOlderMenu();
    const theirs = new Map<string, Uint8Array>([["keystone2.py", enc("print('keystone')\n")]]);
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, [...theirs.keys()]);
    assert.deepEqual(findStaleCopies({ ours, theirs, olderBodies }), []);
    const planned = planUpload({
      base: ours,
      ours,
      theirs,
      olderBodies,
      staleChoice: null,
    });
    assert.equal(planned.needsChoice, false);
    if (!planned.needsChoice) {
      assert.equal(decode(planned.plan.tip.get("keystone2.py")), "print('keystone')\n");
      assert.equal(decode(planned.plan.tip.get("menu.py")), "print('new menu')\n");
    }
  });

  it("does not warn for a new edit", async () => {
    const { fs, head, ours } = await tipWithOlderMenu();
    const theirs = new Map(ours);
    theirs.set("menu.py", enc("print('brand new menu')\n"));
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, ["menu.py"]);
    assert.deepEqual(findStaleCopies({ ours, theirs, olderBodies }), []);
  });

  it("does not warn when only the Pybricks header changed", async () => {
    const { fs } = createMemFs();
    await initRepo(fs);
    const tip = blocksFile("2.1.1", 225, "print('leaf')");
    const head = await commitFiles(fs, { "leaf_cutter_frensie.py": tip }, "leaf");
    const ours = await treeAtCommit(fs, REPO_DIR, head);
    const theirs = new Map(ours);
    theirs.set("leaf_cutter_frensie.py", blocksFile("2.0.0", 4, "print('leaf')"));
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, [
      "leaf_cutter_frensie.py",
    ]);
    assert.deepEqual(findStaleCopies({ ours, theirs, olderBodies }), []);
  });

  it("warns when an older program is re-saved with a new Pybricks header", async () => {
    const { fs } = createMemFs();
    await initRepo(fs);
    await commitFiles(
      fs,
      { "leaf_cutter_frensie.py": blocksFile("2.0.0", 20, "print('old leaf')") },
      "old leaf",
    );
    const head = await commitFiles(
      fs,
      { "leaf_cutter_frensie.py": blocksFile("2.1.1", 225, "print('new leaf')") },
      "new leaf",
    );
    const ours = await treeAtCommit(fs, REPO_DIR, head);
    const uploaded = blocksFile("2.1.1", 80, "print('old leaf')");
    const theirs = new Map(ours);
    theirs.set("leaf_cutter_frensie.py", uploaded);
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, [
      "leaf_cutter_frensie.py",
    ]);
    assert.deepEqual(findStaleCopies({ ours, theirs, olderBodies }), ["leaf_cutter_frensie.py"]);
  });

  it("confirm applies the older bytes on the tip", async () => {
    const { fs, head, ours, oldMenu, newMenu } = await tipWithOlderMenu();
    const keystone = enc("print('keystone')\n");
    const theirs = new Map(ours);
    theirs.set("menu.py", oldMenu);
    theirs.set("keystone2.py", keystone);
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, [...theirs.keys()]);
    const planned = planUpload({
      base: ours,
      ours,
      theirs,
      olderBodies,
      staleChoice: "replace",
    });
    assert.equal(planned.needsChoice, false);
    if (planned.needsChoice) {
      return;
    }
    assert.equal(planned.plan.conflicts.length, 0);
    assert.equal(bytesEqual(planned.plan.tip.get("menu.py"), oldMenu), true);
    assert.equal(bytesEqual(planned.plan.tip.get("keystone2.py"), keystone), true);

    const committed = await commitPlannedTrees({
      fs,
      parentSha: head,
      headTree: ours,
      snapshot: planned.plan.snapshot,
      tip: planned.plan.tip,
      snapshotMessage: snapshotCommitMessage("jj"),
      tipMessage: "jj",
      name: "Joe",
      email: "joe@students.local",
    });
    const tip = await treeAtCommit(fs, REPO_DIR, committed.headSha);
    assert.equal(bytesEqual(tip.get("menu.py"), oldMenu), true);
    assert.equal(await historyHas(fs, committed.headSha, "menu.py", oldMenu), true);
    assert.equal(await historyHas(fs, committed.headSha, "menu.py", newMenu), true);
    assert.equal(await historyHas(fs, committed.headSha, "keystone2.py", keystone), true);
  });

  it("I'm not sure records a conflict and keeps the tip", async () => {
    const { fs, head, ours, oldMenu, newMenu } = await tipWithOlderMenu();
    const keystone = enc("print('keystone')\n");
    const theirs = new Map(ours);
    theirs.set("menu.py", oldMenu);
    theirs.set("keystone2.py", keystone);
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, [...theirs.keys()]);
    const planned = planUpload({
      base: ours,
      ours,
      theirs,
      olderBodies,
      staleChoice: "unsure",
    });
    assert.equal(planned.needsChoice, false);
    if (planned.needsChoice) {
      return;
    }
    assert.equal(planned.plan.conflicts.length, 1);
    assert.equal(planned.plan.conflicts[0]?.path, "menu.py");
    assert.equal(planned.plan.conflicts[0]?.kind, "text");
    assert.equal(bytesEqual(planned.plan.conflicts[0]?.ours, newMenu), true);
    assert.equal(bytesEqual(planned.plan.conflicts[0]?.theirs, oldMenu), true);
    assert.equal(bytesEqual(planned.plan.tip.get("menu.py"), newMenu), true);
    assert.equal(bytesEqual(planned.plan.tip.get("keystone2.py"), keystone), true);

    const committed = await commitPlannedTrees({
      fs,
      parentSha: head,
      headTree: ours,
      snapshot: planned.plan.snapshot,
      tip: planned.plan.tip,
      snapshotMessage: snapshotCommitMessage("jj"),
      tipMessage: "jj",
      name: "Joe",
      email: "joe@students.local",
    });
    const tip = await treeAtCommit(fs, REPO_DIR, committed.headSha);
    assert.equal(bytesEqual(tip.get("menu.py"), newMenu), true);
    assert.equal(bytesEqual(tip.get("keystone2.py"), keystone), true);
    assert.equal(await historyHas(fs, committed.headSha, "menu.py", oldMenu), true);
    assert.equal(await historyHas(fs, committed.headSha, "keystone2.py", keystone), true);
    assert.equal(committed.commits.length, 2);
    assert.equal(committed.commits[0]?.message, snapshotCommitMessage("jj"));
  });

  it("keeps upload-only bytes when a merge conflict would omit them", async () => {
    const { fs } = createMemFs();
    await initRepo(fs);
    const baseText = "line\n";
    await commitFiles(fs, { "main.py": baseText }, "base");
    const head = await commitFiles(fs, { "main.py": "line team\n" }, "team edit");
    const ours = await treeAtCommit(fs, REPO_DIR, head);
    const base = new Map<string, Uint8Array>([["main.py", enc(baseText)]]);
    const uploadedMain = enc("line kid\n");
    const uploadedNew = enc("print('only in the zip')\n");
    const theirs = new Map<string, Uint8Array>([
      ["main.py", uploadedMain],
      ["brand_new.py", uploadedNew],
    ]);
    const olderBodies = await collectOlderBodies(fs, REPO_DIR, head, ours, [...theirs.keys()]);
    const planned = planUpload({
      base,
      ours,
      theirs,
      olderBodies,
      staleChoice: null,
    });
    assert.equal(planned.needsChoice, false);
    if (planned.needsChoice) {
      return;
    }
    assert.equal(planned.plan.conflicts.some((conflict) => conflict.path === "main.py"), true);
    assert.equal(decode(planned.plan.tip.get("main.py")), "line team\n");
    assert.equal(bytesEqual(planned.plan.tip.get("brand_new.py"), uploadedNew), true);
    assert.equal(bytesEqual(planned.plan.snapshot.get("main.py"), uploadedMain), true);

    const committed = await commitPlannedTrees({
      fs,
      parentSha: head,
      headTree: ours,
      snapshot: planned.plan.snapshot,
      tip: planned.plan.tip,
      snapshotMessage: snapshotCommitMessage("both"),
      tipMessage: "both",
      name: "Joe",
      email: "joe@students.local",
    });
    const tip = await treeAtCommit(fs, REPO_DIR, committed.headSha);
    assert.equal(decode(tip.get("main.py")), "line team\n");
    assert.equal(bytesEqual(tip.get("brand_new.py"), uploadedNew), true);
    assert.equal(await historyHas(fs, committed.headSha, "main.py", uploadedMain), true);
    assert.equal(await historyHas(fs, committed.headSha, "brand_new.py", uploadedNew), true);
  });
});

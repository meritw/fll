import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMemFs, initRepo, REPO_DIR, stageAllAndCommit } from "./fs";
import { readDownloadTree } from "./index";

const decode = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

describe("readDownloadTree", () => {
  it("returns the starter main.py when nothing has been uploaded", async () => {
    const { fs } = createMemFs();
    await initRepo(fs);
    const tree = await readDownloadTree({ fs, dir: REPO_DIR, headSha: null });
    assert.equal(tree.starter, true);
    assert.equal(tree.files.size, 1);
    assert.match(decode(tree.files.get("main.py")), /hub\.display\.text\("Hi!"\)/);
  });

  it("uses the working tree when it differs from the saved commit", async () => {
    const { fs } = createMemFs();
    await initRepo(fs);
    await fs.promises.writeFile(`${REPO_DIR}/main.py`, "print(1)\n");
    const sha = await stageAllAndCommit({
      fs,
      message: "first",
      name: "Ava",
      email: "ava@students.local",
    });
    await fs.promises.writeFile(`${REPO_DIR}/main.py`, "print(2)\n");
    const tree = await readDownloadTree({ fs, dir: REPO_DIR, headSha: sha });
    assert.equal(tree.starter, false);
    assert.equal(decode(tree.files.get("main.py")), "print(2)\n");
  });

  it("uses the saved commit when the working tree is empty", async () => {
    const { fs } = createMemFs();
    await initRepo(fs);
    await fs.promises.writeFile(`${REPO_DIR}/main.py`, "print(1)\n");
    const sha = await stageAllAndCommit({
      fs,
      message: "first",
      name: "Ava",
      email: "ava@students.local",
    });
    await fs.promises.unlink(`${REPO_DIR}/main.py`);
    const tree = await readDownloadTree({ fs, dir: REPO_DIR, headSha: sha });
    assert.equal(tree.starter, false);
    assert.equal(decode(tree.files.get("main.py")), "print(1)\n");
  });
});

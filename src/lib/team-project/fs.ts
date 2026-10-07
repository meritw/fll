import git from "isomorphic-git";
import JSZip from "jszip";
import { Volume } from "memfs";

export type GitFs = {
  promises: {
    readFile: typeof import("fs").promises.readFile;
    writeFile: typeof import("fs").promises.writeFile;
    unlink: typeof import("fs").promises.unlink;
    readdir: typeof import("fs").promises.readdir;
    mkdir: typeof import("fs").promises.mkdir;
    rmdir: typeof import("fs").promises.rmdir;
    stat: typeof import("fs").promises.stat;
    lstat: typeof import("fs").promises.lstat;
    readlink: typeof import("fs").promises.readlink;
    symlink: typeof import("fs").promises.symlink;
    chmod?: typeof import("fs").promises.chmod;
  };
};

export const REPO_DIR = "/repo";

export function createMemFs(): { vol: Volume; fs: GitFs } {
  const vol = new Volume();
  return { vol, fs: { promises: vol.promises as unknown as GitFs["promises"] } };
}

export async function initRepo(fs: GitFs, dir = REPO_DIR) {
  await fs.promises.mkdir(dir, { recursive: true });
  await git.init({ fs, dir, defaultBranch: "main" });
}

export async function zipMemfs(vol: Volume, root = REPO_DIR): Promise<Buffer> {
  const zip = new JSZip();
  async function walk(current: string, zipPath: string) {
    let entries: string[];
    try {
      entries = (await vol.promises.readdir(current)) as string[];
    } catch {
      return;
    }
    for (const name of entries) {
      const full = `${current}/${name}`;
      const rel = zipPath ? `${zipPath}/${name}` : name;
      const stat = await vol.promises.stat(full);
      if (stat.isDirectory()) {
        await walk(full, rel);
      } else if (stat.isFile()) {
        const data = (await vol.promises.readFile(full)) as Buffer;
        zip.file(rel, data);
      }
    }
  }
  await walk(root, "");
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return Buffer.from(bytes);
}

export async function unzipIntoMemfs(
  zipBytes: Uint8Array | Buffer,
  vol: Volume,
  root = REPO_DIR,
) {
  const zip = await JSZip.loadAsync(zipBytes);
  await vol.promises.mkdir(root, { recursive: true });
  const files = Object.keys(zip.files).sort();
  for (const name of files) {
    const entry = zip.files[name];
    if (!entry || entry.dir) {
      continue;
    }
    const normalized = name.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!normalized || normalized.includes("..")) {
      continue;
    }
    const full = `${root}/${normalized}`;
    const parent = full.slice(0, full.lastIndexOf("/"));
    if (parent) {
      await vol.promises.mkdir(parent, { recursive: true });
    }
    const data = await entry.async("nodebuffer");
    await vol.promises.writeFile(full, data);
  }
}

/** Unpack a Pybricks project backup zip into a path → bytes map (no .git). */
export async function unzipProjectFiles(
  zipBytes: Uint8Array | Buffer,
): Promise<Map<string, Uint8Array>> {
  const zip = await JSZip.loadAsync(zipBytes);
  const files = new Map<string, Uint8Array>();
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (!entry || entry.dir) {
      continue;
    }
    const normalized = name.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!normalized || normalized.includes("..") || normalized.startsWith(".git/")) {
      continue;
    }
    // Ignore macOS junk.
    if (normalized.startsWith("__MACOSX/") || normalized.endsWith(".DS_Store")) {
      continue;
    }
    const data = await entry.async("uint8array");
    files.set(normalized, data);
  }
  return files;
}

export async function zipProjectFiles(files: Map<string, Uint8Array>): Promise<Buffer> {
  const zip = new JSZip();
  const paths = [...files.keys()].sort();
  for (const path of paths) {
    zip.file(path, files.get(path)!);
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return Buffer.from(bytes);
}

export async function readWorkingTree(
  fs: GitFs,
  dir = REPO_DIR,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  async function walk(current: string, rel: string) {
    const entries = (await fs.promises.readdir(current)) as string[];
    for (const name of entries) {
      if (!rel && name === ".git") {
        continue;
      }
      const full = `${current}/${name}`;
      const nextRel = rel ? `${rel}/${name}` : name;
      const stat = await fs.promises.stat(full);
      if (stat.isDirectory()) {
        await walk(full, nextRel);
      } else if (stat.isFile()) {
        const data = (await fs.promises.readFile(full)) as Buffer;
        files.set(nextRel, new Uint8Array(data));
      }
    }
  }
  await walk(dir, "");
  return files;
}

export async function replaceWorkingTree(
  fs: GitFs,
  files: Map<string, Uint8Array>,
  dir = REPO_DIR,
) {
  const existing = await readWorkingTree(fs, dir);
  for (const path of existing.keys()) {
    await fs.promises.unlink(`${dir}/${path}`);
  }
  for (const [path, data] of files) {
    const full = `${dir}/${path}`;
    const parent = full.slice(0, full.lastIndexOf("/"));
    if (parent && parent !== dir) {
      await fs.promises.mkdir(parent, { recursive: true });
    }
    await fs.promises.writeFile(full, Buffer.from(data));
  }
}

export async function treeAtCommit(
  fs: GitFs,
  dir: string,
  ref: string,
): Promise<Map<string, Uint8Array>> {
  let commitOid = ref;
  try {
    commitOid = await git.resolveRef({ fs, dir, ref });
  } catch {
    // ref may already be an oid
  }
  const files = new Map<string, Uint8Array>();
  await git.walk({
    fs,
    dir,
    trees: [git.TREE({ ref: commitOid })],
    map: async (filepath, [entry]) => {
      if (!filepath || filepath === ".") {
        return;
      }
      if (!entry) {
        return;
      }
      const type = await entry.type();
      if (type !== "blob") {
        return;
      }
      const content = await entry.content();
      if (content) {
        files.set(filepath, content);
      }
    },
  });
  return files;
}

export async function stageAllAndCommit(input: {
  fs: GitFs;
  dir?: string;
  message: string;
  name: string;
  email: string;
}) {
  const dir = input.dir ?? REPO_DIR;
  const status = await git.statusMatrix({ fs: input.fs, dir });
  for (const [filepath, head, workdir] of status) {
    if (!filepath || filepath === ".") {
      continue;
    }
    // statusMatrix: 0 absent, 1 present identical, 2 present different
    if (workdir === 0) {
      if (head === 1) {
        await git.remove({ fs: input.fs, dir, filepath });
      }
    } else {
      await git.add({ fs: input.fs, dir, filepath });
    }
  }
  return git.commit({
    fs: input.fs,
    dir,
    message: input.message,
    author: { name: input.name, email: input.email },
  });
}

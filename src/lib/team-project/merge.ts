import * as Diff3 from "node-diff3";

const TEXT_EXTENSIONS = new Set([
  "py",
  "txt",
  "md",
  "json",
  "cfg",
  "ini",
  "yml",
  "yaml",
  "toml",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "csv",
  "xml",
  "svg",
]);

export type FileBytes = Uint8Array | null;

export type MergeFileResult =
  | { status: "unchanged" | "auto"; content: Uint8Array | null }
  | {
      status: "conflict";
      kind: "text" | "binary";
      base: FileBytes;
      ours: FileBytes;
      theirs: FileBytes;
    };

function bytesEqual(a: FileBytes, b: FileBytes) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function isProbablyText(path: string, data: FileBytes) {
  const ext = path.includes(".") ? path.split(".").pop()!.toLowerCase() : "";
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }
  if (!data || data.byteLength === 0) {
    return true;
  }
  // NUL byte ⇒ binary.
  const sample = data.subarray(0, Math.min(data.byteLength, 8000));
  for (let i = 0; i < sample.byteLength; i += 1) {
    if (sample[i] === 0) {
      return false;
    }
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

function decode(data: FileBytes) {
  if (!data) {
    return "";
  }
  return new TextDecoder("utf-8").decode(data);
}

function encode(text: string) {
  return new TextEncoder().encode(text);
}

function splitLines(text: string) {
  if (text === "") {
    return [] as string[];
  }
  return text.split("\n");
}

function joinLines(lines: string[]) {
  return lines.join("\n");
}

/** Classic 3-way merge for one path. Deletion = null content. */
export function mergeOneFile(
  path: string,
  base: FileBytes,
  ours: FileBytes,
  theirs: FileBytes,
): MergeFileResult {
  if (bytesEqual(ours, theirs)) {
    return { status: "unchanged", content: ours };
  }
  if (bytesEqual(base, ours)) {
    return { status: "auto", content: theirs };
  }
  if (bytesEqual(base, theirs)) {
    return { status: "auto", content: ours };
  }

  const treatAsText =
    isProbablyText(path, base) &&
    isProbablyText(path, ours) &&
    isProbablyText(path, theirs);

  if (!treatAsText) {
    // Binary: both sides changed differently → conflict (no silent last-write-wins).
    return { status: "conflict", kind: "binary", base, ours, theirs };
  }

  // Deleted on both differently already handled; one deleted + other edited:
  if (!ours || !theirs) {
    return { status: "conflict", kind: "text", base, ours, theirs };
  }

  const merged = Diff3.merge(
    splitLines(decode(ours)),
    splitLines(decode(base)),
    splitLines(decode(theirs)),
  );
  if (merged.conflict) {
    return { status: "conflict", kind: "text", base, ours, theirs };
  }
  return { status: "auto", content: encode(joinLines(merged.result)) };
}

export function mergeTrees(
  base: Map<string, Uint8Array>,
  ours: Map<string, Uint8Array>,
  theirs: Map<string, Uint8Array>,
) {
  const paths = new Set<string>([...base.keys(), ...ours.keys(), ...theirs.keys()]);
  const result = new Map<string, Uint8Array>();
  const conflicts: Array<{
    path: string;
    kind: "text" | "binary";
    base: FileBytes;
    ours: FileBytes;
    theirs: FileBytes;
  }> = [];

  for (const path of [...paths].sort()) {
    const merged = mergeOneFile(
      path,
      base.get(path) ?? null,
      ours.get(path) ?? null,
      theirs.get(path) ?? null,
    );
    if (merged.status === "conflict") {
      conflicts.push({
        path,
        kind: merged.kind,
        base: merged.base,
        ours: merged.ours,
        theirs: merged.theirs,
      });
      continue;
    }
    if (merged.content) {
      result.set(path, merged.content);
    }
  }

  return { result, conflicts };
}

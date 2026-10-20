/**
 * Spot a kid uploading the RollingSparks.zip they downloaded in Step 1 instead of
 * the pybricks-backup zip from Pybricks. Shared by the browser and the server, so
 * it must not import Node-only modules.
 *
 * Pybricks builds its backup zip from scratch, so our zip comment never survives
 * a round trip through Pybricks. A zip that still carries it came straight from
 * our Download button.
 */

const DOWNLOAD_COMMENT_PREFIX = "Rolling Sparks team code from the Coding Page";

export const SAME_ZIP_ERROR_CODE = "same_as_download";

export const SAME_ZIP_ERROR =
  "That is the RollingSparks file from Step 1, so your new work is not in it. Go back to Pybricks, click Backup all files, then upload the pybricks-backup file.";

export function downloadZipComment(headSha: string | null) {
  return headSha ? `${DOWNLOAD_COMMENT_PREFIX} (${headSha})` : DOWNLOAD_COMMENT_PREFIX;
}

export function hasDownloadComment(comment: string | null | undefined) {
  return Boolean(comment?.startsWith(DOWNLOAD_COMMENT_PREFIX));
}

/** Matches RollingSparks.zip, RollingSparks (2).zip, RollingSparks-git.zip. */
export function hasDownloadName(fileName: string) {
  const base = fileName.split(/[\\/]/).pop()?.trim().toLowerCase() ?? "";
  return base.startsWith("rollingsparks") && !base.includes("pybricks-backup");
}

export function looksLikeTeamDownload(input: { fileName: string; zipComment?: string | null }) {
  return hasDownloadComment(input.zipComment) || hasDownloadName(input.fileName);
}

export function sameFiles(a: Map<string, Uint8Array>, b: Map<string, Uint8Array>) {
  if (a.size !== b.size) {
    return false;
  }
  for (const [path, left] of a) {
    const right = b.get(path);
    if (!right || right.byteLength !== left.byteLength) {
      return false;
    }
    for (let i = 0; i < left.byteLength; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Both signals must agree: the zip looks like our download (comment or name) and
 * its files match a tree we handed out. A real Pybricks backup with no edits has
 * neither the comment nor the name, so it is never flagged.
 */
export function isUnchangedTeamDownload(input: {
  fileName: string;
  zipComment?: string | null;
  files: Map<string, Uint8Array>;
  downloadedTrees: Array<Map<string, Uint8Array>>;
}) {
  if (!looksLikeTeamDownload(input)) {
    return false;
  }
  return input.downloadedTrees.some((tree) => sameFiles(tree, input.files));
}

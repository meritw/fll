export function browseHref(input: {
  file?: string | null;
  sha?: string | null;
  changes?: boolean;
  before?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.file) {
    params.set("file", input.file);
  }
  if (input.sha) {
    params.set("sha", input.sha);
  }
  if (input.changes) {
    params.set("view", "changes");
  }
  if (input.before) {
    params.set("before", input.before);
  }
  const query = params.toString();
  return query ? `/home/files?${query}` : "/home/files";
}

export function formatWhen(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

export function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "program.llsp3";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const withName = cleaned.length > 0 ? cleaned : "program.llsp3";
  return withName.toLowerCase().endsWith(".llsp3") ? withName : `${withName}.llsp3`;
}

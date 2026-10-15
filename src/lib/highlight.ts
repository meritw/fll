import { createHash } from "node:crypto";

import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import python from "@shikijs/langs/python";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";

import { splitBrowseLines } from "@/lib/team-project/browse";

export type HighlightLanguage = "python" | "plaintext";

const MAX_HIGHLIGHT_LINES = 4000;
const CACHE_MAX = 64;

const lineCache = new Map<string, string[]>();
let highlighterPromise: Promise<HighlighterCore> | null = null;

function highlighter() {
  highlighterPromise ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [python],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function remember(key: string, lines: string[]) {
  lineCache.delete(key);
  lineCache.set(key, lines);
  if (lineCache.size <= CACHE_MAX) {
    return;
  }
  const oldest = lineCache.keys().next().value;
  if (oldest) {
    lineCache.delete(oldest);
  }
}

function plainLines(text: string): string[] {
  return splitBrowseLines(text).map((line) => escapeHtml(line));
}

function spanFor(content: string, style: Record<string, string> | undefined): string {
  const body = escapeHtml(content);
  if (!style) {
    return body;
  }
  const css = Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `<span class="code-token" style="${escapeHtml(css)}">${body}</span>`;
}

export async function highlightLines(text: string, language: HighlightLanguage): Promise<string[]> {
  if (text.length === 0) {
    return [];
  }
  const key = createHash("sha1").update(language).update("\0").update(text).digest("hex");
  const cached = lineCache.get(key);
  if (cached) {
    remember(key, cached);
    return cached;
  }
  const plain = plainLines(text);
  if (language !== "python" || plain.length > MAX_HIGHLIGHT_LINES) {
    remember(key, plain);
    return plain;
  }
  const core = await highlighter();
  const { tokens } = core.codeToTokens(text, {
    lang: "python",
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
  let tokenLines = tokens;
  if (text.endsWith("\n") && tokenLines.length === plain.length + 1) {
    const last = tokenLines[tokenLines.length - 1] ?? [];
    if (last.every((token) => token.content === "")) {
      tokenLines = tokenLines.slice(0, -1);
    }
  }
  if (tokenLines.length !== plain.length) {
    remember(key, plain);
    return plain;
  }
  const lines = tokenLines.map((line) => line.map((token) => spanFor(token.content, token.htmlStyle)).join(""));
  remember(key, lines);
  return lines;
}

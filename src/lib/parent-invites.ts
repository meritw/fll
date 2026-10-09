import { isPlaceholderEmail, normalizeEmail } from "@/lib/coaches";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** `Display Name <email@domain>` (angle brackets). */
const NAMED_EMAIL_RE = /([^,\n<>]*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>/g;

export type ParseParentInviteListResult = {
  /** Deduped, normalized emails ready to invite. */
  emails: string[];
  /** Tokens that looked like invites but were not valid emails. */
  invalid: string[];
};

/**
 * Parse a coach-pasted parent list. Supports:
 * - `Name <email@domain.com>,`
 * - bare `email@domain.com` (comma or newline separated)
 * Display names are ignored — parents set their own name on first login.
 */
export function parseParentInviteList(text: string): ParseParentInviteListResult {
  const found: string[] = [];
  const invalid: string[] = [];
  let remaining = text;

  remaining = remaining.replace(NAMED_EMAIL_RE, (_full, _name, email: string) => {
    found.push(email);
    return " ";
  });

  for (const token of remaining.split(/[\n,;]+/)) {
    const trimmed = token.trim();
    if (!trimmed) {
      continue;
    }
    found.push(trimmed);
  }

  const emails: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const email = normalizeEmail(raw.replace(/^mailto:/i, ""));
    if (!EMAIL_RE.test(email) || isPlaceholderEmail(email)) {
      invalid.push(raw.trim());
      continue;
    }
    if (seen.has(email)) {
      continue;
    }
    seen.add(email);
    emails.push(email);
  }

  return { emails, invalid };
}

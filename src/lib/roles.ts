/** App roles stored on `user.role` (text + DB check constraint). */
export const ROLES = ["student", "coach", "parent"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string | null | undefined): value is Role {
  return value === "student" || value === "coach" || value === "parent";
}

export function isCoach(role: string | null | undefined) {
  return role === "coach";
}

export function isParent(role: string | null | undefined) {
  return role === "parent";
}

export function isStudent(role: string | null | undefined) {
  return role === "student";
}

/** Adults who sign in with a real email (magic link / OTP / password reset). */
export function usesEmailSignIn(role: string | null | undefined) {
  return role === "coach" || role === "parent";
}

export function roleLabel(role: string | null | undefined) {
  if (role === "coach") return "Coach";
  if (role === "parent") return "Parent";
  if (role === "student") return "Student";
  return role ?? "Unknown";
}

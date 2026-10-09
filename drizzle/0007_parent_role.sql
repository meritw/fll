-- Allow parent alongside student/coach on user.role (text column + check).
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_role_check";
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("role" IN ('student', 'coach', 'parent'));
--> statement-breakpoint
-- Parents set their display name on first login (coach invite is email-only).
ALTER TABLE "user" ADD COLUMN "must_set_display_name" boolean DEFAULT false NOT NULL;

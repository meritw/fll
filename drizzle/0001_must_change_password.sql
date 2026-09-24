ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user" SET "must_change_password" = true WHERE "role" = 'student';

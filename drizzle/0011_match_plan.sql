-- The team's shared Match plan: one row, the whole plan as jsonb, written only by
-- a compare-and-swap on "version". int4, not int8, so Realtime rows decode it as a number.
-- "generation" counts resets, so ops made before a reset are dropped instead of landing on the sample.
-- "recent_batches" keeps the last 64 saved batch ids, so a resend after a lost reply is not applied twice.
CREATE TABLE "match_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"recent_batches" text[] DEFAULT '{}' NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_plan_singleton" CHECK ("id" = 'default')
);
--> statement-breakpoint
ALTER TABLE "match_plan" ADD CONSTRAINT "match_plan_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

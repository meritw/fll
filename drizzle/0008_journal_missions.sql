-- Journal revamp + Missions: mission status/assignments/notes, live meetings, milestones, season dates.
ALTER TABLE "mission" ADD COLUMN "status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "mission" ADD CONSTRAINT "mission_status_check" CHECK ("status" IN ('none','trying','some','every'));--> statement-breakpoint
ALTER TABLE "mission" ADD COLUMN "status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mission" ADD COLUMN "status_updated_by_id" text;--> statement-breakpoint
ALTER TABLE "mission" ADD CONSTRAINT "mission_status_updated_by_id_user_id_fk" FOREIGN KEY ("status_updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "mission_assignment" (
	"mission_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mission_assignment_mission_id_user_id_pk" PRIMARY KEY("mission_id","user_id")
);--> statement-breakpoint
ALTER TABLE "mission_assignment" ADD CONSTRAINT "mission_assignment_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_assignment" ADD CONSTRAINT "mission_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_assignment" ADD CONSTRAINT "mission_assignment_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_assignment_user_idx" ON "mission_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "mission_note" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" integer NOT NULL,
	"meeting_id" text,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "mission_note" ADD CONSTRAINT "mission_note_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_note" ADD CONSTRAINT "mission_note_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_note" ADD CONSTRAINT "mission_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_note_mission_idx" ON "mission_note" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "mission_note_meeting_idx" ON "mission_note" USING btree ("meeting_id");--> statement-breakpoint
CREATE TABLE "mission_status_event" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" integer NOT NULL,
	"meeting_id" text,
	"status" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "mission_status_event" ADD CONSTRAINT "mission_status_event_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_status_event" ADD CONSTRAINT "mission_status_event_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_status_event" ADD CONSTRAINT "mission_status_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_status_event_mission_idx" ON "mission_status_event" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "mission_status_event_meeting_idx" ON "mission_status_event" USING btree ("meeting_id");--> statement-breakpoint
CREATE TABLE "season_event" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"day_key" text NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "season_event" ADD CONSTRAINT "season_event_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "day_key" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_day_key_unique" UNIQUE("day_key");--> statement-breakpoint
ALTER TABLE "journal_entry" ADD COLUMN "milestone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Meetings are no longer pre-scheduled. Remove seeded future shells that have no content,
-- so live-started meetings get clean session numbers. Rows with any content are kept.
DELETE FROM "meeting" m
WHERE m."seed_key" IS NOT NULL
  AND m."starts_at" > now()
  AND m."summary" IS NULL
  AND m."attendance_recorded_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "meeting_attendee" a WHERE a."meeting_id" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "meeting_note" n WHERE n."meeting_id" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "meeting_media" x WHERE x."meeting_id" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "journal_entry" j WHERE j."related_meeting_id" = m."id");

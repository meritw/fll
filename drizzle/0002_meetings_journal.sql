CREATE TABLE "meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"title" text,
	"summary" text,
	"seed_key" text,
	"created_by_id" text,
	"attendance_recorded_by_id" text,
	"attendance_recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_seed_key_unique" UNIQUE("seed_key")
);
--> statement-breakpoint
CREATE TABLE "meeting_attendee" (
	"meeting_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "meeting_attendee_meeting_id_user_id_pk" PRIMARY KEY("meeting_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_note" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"related_meeting_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_attendance_recorded_by_id_user_id_fk" FOREIGN KEY ("attendance_recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendee" ADD CONSTRAINT "meeting_attendee_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendee" ADD CONSTRAINT "meeting_attendee_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_related_meeting_id_meeting_id_fk" FOREIGN KEY ("related_meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_starts_at_idx" ON "meeting" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "meeting_note_meeting_idx" ON "meeting_note" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "journal_entry_created_at_idx" ON "journal_entry" USING btree ("created_at");

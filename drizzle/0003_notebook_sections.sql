ALTER TABLE "meeting" ADD COLUMN "session_number" integer;--> statement-breakpoint
ALTER TABLE "meeting_note" ADD COLUMN "kind" text DEFAULT 'progress' NOT NULL;--> statement-breakpoint
CREATE INDEX "meeting_note_meeting_kind_idx" ON "meeting_note" USING btree ("meeting_id","kind");

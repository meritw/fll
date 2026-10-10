-- Photos/videos can belong to a meeting day, or to a "from home" journal note
-- (Extra notes), the same way journal entries can be written without a meeting.
ALTER TABLE "meeting_media" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_media" ADD COLUMN "journal_entry_id" text;--> statement-breakpoint
ALTER TABLE "meeting_media" ADD COLUMN "from_home" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_media" ADD CONSTRAINT "meeting_media_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_media_journal_entry_idx" ON "meeting_media" USING btree ("journal_entry_id");--> statement-breakpoint
ALTER TABLE "meeting_media" ADD CONSTRAINT "meeting_media_meeting_or_home_check" CHECK (
  ("meeting_id" IS NOT NULL AND "from_home" = false)
  OR ("meeting_id" IS NULL AND "from_home" = true)
);

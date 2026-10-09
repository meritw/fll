-- "From home" is now an explicit choice instead of "has no meeting".
ALTER TABLE "journal_entry" ADD COLUMN "from_home" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Notes from the old journal page often skipped the optional "Related meeting"
-- picker. Attach each one to the meeting held that same day (team time zone), if any.
UPDATE "journal_entry" j
SET "related_meeting_id" = (
  SELECT m."id" FROM "meeting" m
  WHERE (m."starts_at" AT TIME ZONE 'America/New_York')::date
      = (j."created_at" AT TIME ZONE 'America/New_York')::date
  ORDER BY m."starts_at"
  LIMIT 1
)
WHERE j."related_meeting_id" IS NULL;

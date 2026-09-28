CREATE TABLE "meeting_media" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"uploader_id" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"caption" text,
	"file_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_media" ADD CONSTRAINT "meeting_media_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_media" ADD CONSTRAINT "meeting_media_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_media_meeting_idx" ON "meeting_media" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_media_created_at_idx" ON "meeting_media" USING btree ("created_at");

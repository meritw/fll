CREATE TABLE "team_project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"head_sha" text,
	"repo_object_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_project_commit" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"sha" text NOT NULL,
	"parent_sha" text,
	"base_sha" text,
	"message" text NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"upload_object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_project_upload" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"base_sha" text,
	"status" text NOT NULL,
	"result_commit_sha" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_project_conflict" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"upload_id" text NOT NULL,
	"path" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"base_content" text,
	"ours_content" text,
	"theirs_content" text,
	"base_object_key" text,
	"ours_object_key" text,
	"theirs_object_key" text,
	"resolution" text,
	"resolved_content" text,
	"resolved_object_key" text,
	"uploaded_by_id" text NOT NULL,
	"resolved_by_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_project_commit" ADD CONSTRAINT "team_project_commit_project_id_team_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."team_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_commit" ADD CONSTRAINT "team_project_commit_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_upload" ADD CONSTRAINT "team_project_upload_project_id_team_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."team_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_upload" ADD CONSTRAINT "team_project_upload_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_conflict" ADD CONSTRAINT "team_project_conflict_project_id_team_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."team_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_conflict" ADD CONSTRAINT "team_project_conflict_upload_id_team_project_upload_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."team_project_upload"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_conflict" ADD CONSTRAINT "team_project_conflict_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_conflict" ADD CONSTRAINT "team_project_conflict_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_project_commit_sha" ON "team_project_commit" USING btree ("project_id","sha");--> statement-breakpoint
CREATE INDEX "team_project_commit_project_idx" ON "team_project_commit" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "team_project_commit_created_idx" ON "team_project_commit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "team_project_upload_project_idx" ON "team_project_upload" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "team_project_upload_status_idx" ON "team_project_upload" USING btree ("status");--> statement-breakpoint
CREATE INDEX "team_project_conflict_project_idx" ON "team_project_conflict" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "team_project_conflict_upload_idx" ON "team_project_conflict" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "team_project_conflict_status_idx" ON "team_project_conflict" USING btree ("status");

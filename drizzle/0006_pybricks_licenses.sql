CREATE TABLE "pybricks_license" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"seat_kind" text NOT NULL,
	"seat_index" integer NOT NULL,
	"assigned_user_id" text,
	"assigned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pybricks_license_code_unique" UNIQUE("code"),
	CONSTRAINT "pybricks_license_seat_index_unique" UNIQUE("seat_index"),
	CONSTRAINT "pybricks_license_assigned_user_unique" UNIQUE("assigned_user_id")
);
--> statement-breakpoint
ALTER TABLE "pybricks_license" ADD CONSTRAINT "pybricks_license_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pybricks_license_assigned_user_idx" ON "pybricks_license" USING btree ("assigned_user_id");

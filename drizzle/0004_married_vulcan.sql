CREATE TABLE "system_prompt" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"variables" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_prompt_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "system_prompt" ADD CONSTRAINT "system_prompt_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE TABLE "allowed_email" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"domain" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "allowed_email" ADD CONSTRAINT "allowed_email_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
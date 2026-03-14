CREATE TABLE "analysis_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"loaded_experiments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"summary_tokens" integer,
	"summary_up_to_message_id" text,
	"sharing_uuid" text,
	"sharing_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_chat_sharing_uuid_unique" UNIQUE("sharing_uuid")
);
--> statement-breakpoint
CREATE TABLE "analysis_chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"content" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_chat" ADD CONSTRAINT "analysis_chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_chat_message" ADD CONSTRAINT "analysis_chat_message_chat_id_analysis_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."analysis_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analysis_chat_user" ON "analysis_chat" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_analysis_chat_message_chat" ON "analysis_chat_message" USING btree ("chat_id","created_at");
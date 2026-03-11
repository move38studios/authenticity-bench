ALTER TABLE "experiment" ADD COLUMN "preview_token" text;--> statement-breakpoint
ALTER TABLE "experiment" ADD CONSTRAINT "experiment_preview_token_unique" UNIQUE("preview_token");
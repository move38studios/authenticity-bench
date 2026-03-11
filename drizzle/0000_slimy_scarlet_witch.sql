CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allowed_email" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"domain" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" text,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" integer,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dilemma" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"scenario" text NOT NULL,
	"domain" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"options" jsonb NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"inquiry_tools" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mental_technique" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_config" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"temperature" real DEFAULT 1 NOT NULL,
	"top_p" real,
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"extra_params" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "values_system" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"judgment_modes" jsonb NOT NULL,
	"noise_repeats" integer DEFAULT 3 NOT NULL,
	"total_judgments" integer,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"analysis_status" text DEFAULT 'pending',
	"analysis_report" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_combo" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"combo_type" text NOT NULL,
	"item_ids" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_dilemma" (
	"experiment_id" text NOT NULL,
	"dilemma_id" text NOT NULL,
	CONSTRAINT "experiment_dilemma_experiment_id_dilemma_id_pk" PRIMARY KEY("experiment_id","dilemma_id")
);
--> statement-breakpoint
CREATE TABLE "experiment_mental_technique" (
	"experiment_id" text NOT NULL,
	"mental_technique_id" text NOT NULL,
	CONSTRAINT "experiment_mental_technique_experiment_id_mental_technique_id_pk" PRIMARY KEY("experiment_id","mental_technique_id")
);
--> statement-breakpoint
CREATE TABLE "experiment_model_config" (
	"experiment_id" text NOT NULL,
	"model_config_id" text NOT NULL,
	CONSTRAINT "experiment_model_config_experiment_id_model_config_id_pk" PRIMARY KEY("experiment_id","model_config_id")
);
--> statement-breakpoint
CREATE TABLE "experiment_modifier" (
	"experiment_id" text NOT NULL,
	"modifier_id" text NOT NULL,
	CONSTRAINT "experiment_modifier_experiment_id_modifier_id_pk" PRIMARY KEY("experiment_id","modifier_id")
);
--> statement-breakpoint
CREATE TABLE "experiment_values_system" (
	"experiment_id" text NOT NULL,
	"values_system_id" text NOT NULL,
	CONSTRAINT "experiment_values_system_experiment_id_values_system_id_pk" PRIMARY KEY("experiment_id","values_system_id")
);
--> statement-breakpoint
CREATE TABLE "judgment" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"dilemma_id" text NOT NULL,
	"model_config_id" text NOT NULL,
	"values_system_id" text,
	"mental_technique_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modifier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"judgment_mode" text NOT NULL,
	"noise_index" integer NOT NULL,
	"system_prompt" text,
	"user_prompt" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"choice" text,
	"reasoning" text,
	"confidence" real,
	"raw_response" jsonb,
	"inquiry_tool_calls" jsonb,
	"error_message" text,
	"latency_ms" integer,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"reasoning_tokens" integer,
	"cost_estimate" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowed_email" ADD CONSTRAINT "allowed_email_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dilemma" ADD CONSTRAINT "dilemma_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mental_technique" ADD CONSTRAINT "mental_technique_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_config" ADD CONSTRAINT "model_config_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier" ADD CONSTRAINT "modifier_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "values_system" ADD CONSTRAINT "values_system_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment" ADD CONSTRAINT "experiment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_combo" ADD CONSTRAINT "experiment_combo_experiment_id_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_dilemma" ADD CONSTRAINT "experiment_dilemma_experiment_id_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_dilemma" ADD CONSTRAINT "experiment_dilemma_dilemma_id_dilemma_id_fk" FOREIGN KEY ("dilemma_id") REFERENCES "public"."dilemma"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_mental_technique" ADD CONSTRAINT "experiment_mental_technique_experiment_id_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_mental_technique" ADD CONSTRAINT "experiment_mental_technique_mental_technique_id_mental_technique_id_fk" FOREIGN KEY ("mental_technique_id") REFERENCES "public"."mental_technique"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_model_config" ADD CONSTRAINT "experiment_model_config_experiment_id_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_model_config" ADD CONSTRAINT "experiment_model_config_model_config_id_model_config_id_fk" FOREIGN KEY ("model_config_id") REFERENCES "public"."model_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_modifier" ADD CONSTRAINT "experiment_modifier_experiment_id_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_modifier" ADD CONSTRAINT "experiment_modifier_modifier_id_modifier_id_fk" FOREIGN KEY ("modifier_id") REFERENCES "public"."modifier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_values_system" ADD CONSTRAINT "experiment_values_system_experiment_id_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_values_system" ADD CONSTRAINT "experiment_values_system_values_system_id_values_system_id_fk" FOREIGN KEY ("values_system_id") REFERENCES "public"."values_system"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_experiment_id_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_dilemma_id_dilemma_id_fk" FOREIGN KEY ("dilemma_id") REFERENCES "public"."dilemma"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_model_config_id_model_config_id_fk" FOREIGN KEY ("model_config_id") REFERENCES "public"."model_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_values_system_id_values_system_id_fk" FOREIGN KEY ("values_system_id") REFERENCES "public"."values_system"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_api_key" ADD CONSTRAINT "provider_api_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_judgment_experiment" ON "judgment" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_judgment_status" ON "judgment" USING btree ("experiment_id","status");--> statement-breakpoint
CREATE INDEX "idx_judgment_model" ON "judgment" USING btree ("experiment_id","model_config_id");--> statement-breakpoint
CREATE INDEX "idx_judgment_dilemma" ON "judgment" USING btree ("experiment_id","dilemma_id");
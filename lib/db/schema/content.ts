import {
  pgTable,
  text,
  timestamp,
  boolean,
  real,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const modelConfig = pgTable("model_config", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  displayName: text("display_name").notNull(),
  temperature: real("temperature").notNull().default(1.0),
  topP: real("top_p"),
  maxTokens: integer("max_tokens").notNull().default(4096),
  extraParams: jsonb("extra_params"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dilemma = pgTable("dilemma", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  scenario: text("scenario").notNull(),
  domain: text("domain"),
  options: jsonb("options").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  actionTool: jsonb("action_tool"),
  inquiryTools: jsonb("inquiry_tools"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const valuesSystem = pgTable("values_system", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mentalTechnique = pgTable("mental_technique", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const modifier = pgTable("modifier", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const analysisChat = pgTable(
  "analysis_chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    loadedExperiments: jsonb("loaded_experiments")
      .notNull()
      .default([]), // [{experimentId, blobUrl, name, loadedAt}]
    summary: text("summary"),
    summaryTokens: integer("summary_tokens"),
    summaryUpToMessageId: text("summary_up_to_message_id"),
    sharingUuid: text("sharing_uuid").unique(),
    sharingEnabled: boolean("sharing_enabled").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_analysis_chat_user").on(table.userId, table.updatedAt)]
);

export const analysisChatMessage = pgTable(
  "analysis_chat_message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => analysisChat.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant'
    parts: jsonb("parts").notNull(), // AI SDK v6 parts array
    content: text("content"), // extracted plain text for search
    metadata: jsonb("metadata"), // {model, tokens: {prompt, completion}, timing}
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_analysis_chat_message_chat").on(table.chatId, table.createdAt)]
);

// Relations
export const analysisChatRelations = relations(analysisChat, ({ many, one }) => ({
  messages: many(analysisChatMessage),
  user: one(user, { fields: [analysisChat.userId], references: [user.id] }),
}));

export const analysisChatMessageRelations = relations(analysisChatMessage, ({ one }) => ({
  chat: one(analysisChat, { fields: [analysisChatMessage.chatId], references: [analysisChat.id] }),
}));

import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const briefsTable = pgTable("briefs", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").notNull(),
  title: text("title").notNull(),
  briefType: text("brief_type").notNull(),
  tone: text("tone").notNull(),
  outlineText: text("outline_text").notNull(),
  sections: text("sections"),
  score: text("score"),
  summary: text("summary"),
  tags: text("tags"),
  prompt: text("prompt"),
  sourceNotes: text("source_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBriefSchema = createInsertSchema(briefsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrief = z.infer<typeof insertBriefSchema>;
export type Brief = typeof briefsTable.$inferSelect;

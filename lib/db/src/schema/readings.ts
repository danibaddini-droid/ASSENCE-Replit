import { pgTable, text, serial, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const readingsTable = pgTable("readings", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time"),
  birthPlace: text("birth_place").notNull(),
  birthChart: json("birth_chart").notNull(),
  analysis: text("analysis"),
  analysisStatus: text("analysis_status").notNull().default("pending"),
  transitAnalysis: text("transit_analysis"),
  transitAnalysisStatus: text("transit_analysis_status").notNull().default("pending"),
  clientAge: integer("client_age"),
  clientEmail: text("client_email"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReadingSchema = createInsertSchema(readingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReading = z.infer<typeof insertReadingSchema>;
export type Reading = typeof readingsTable.$inferSelect;

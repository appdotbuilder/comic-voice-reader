import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for comic status
export const comicStatusEnum = pgEnum('comic_status', ['ongoing', 'completed', 'hiatus']);

// Comics table
export const comicsTable = pgTable('comics', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'), // Nullable by default
  thumbnail_url: text('thumbnail_url'), // Nullable by default
  source_url: text('source_url').notNull(), // URL from komiku.org
  status: comicStatusEnum('status').notNull().default('ongoing'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Chapters table
export const chaptersTable = pgTable('chapters', {
  id: serial('id').primaryKey(),
  comic_id: integer('comic_id').notNull().references(() => comicsTable.id, { onDelete: 'cascade' }),
  chapter_number: integer('chapter_number').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  source_url: text('source_url').notNull(), // URL from komiku.org
  page_count: integer('page_count').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Comic pages table
export const comicPagesTable = pgTable('comic_pages', {
  id: serial('id').primaryKey(),
  chapter_id: integer('chapter_id').notNull().references(() => chaptersTable.id, { onDelete: 'cascade' }),
  page_number: integer('page_number').notNull(),
  image_url: text('image_url').notNull(),
  source_url: text('source_url').notNull(), // Original URL from komiku.org
  ocr_text: text('ocr_text'), // Extracted text from OCR, nullable
  ocr_processed_at: timestamp('ocr_processed_at'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Reading progress table for tracking user progress
export const readingProgressTable = pgTable('reading_progress', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(), // Simple string-based user identification
  comic_id: integer('comic_id').notNull().references(() => comicsTable.id, { onDelete: 'cascade' }),
  chapter_id: integer('chapter_id').notNull().references(() => chaptersTable.id, { onDelete: 'cascade' }),
  page_id: integer('page_id').notNull().references(() => comicPagesTable.id, { onDelete: 'cascade' }),
  last_read_at: timestamp('last_read_at').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Define relations
export const comicsRelations = relations(comicsTable, ({ many }) => ({
  chapters: many(chaptersTable),
  readingProgress: many(readingProgressTable)
}));

export const chaptersRelations = relations(chaptersTable, ({ one, many }) => ({
  comic: one(comicsTable, {
    fields: [chaptersTable.comic_id],
    references: [comicsTable.id]
  }),
  pages: many(comicPagesTable),
  readingProgress: many(readingProgressTable)
}));

export const comicPagesRelations = relations(comicPagesTable, ({ one, many }) => ({
  chapter: one(chaptersTable, {
    fields: [comicPagesTable.chapter_id],
    references: [chaptersTable.id]
  }),
  readingProgress: many(readingProgressTable)
}));

export const readingProgressRelations = relations(readingProgressTable, ({ one }) => ({
  comic: one(comicsTable, {
    fields: [readingProgressTable.comic_id],
    references: [comicsTable.id]
  }),
  chapter: one(chaptersTable, {
    fields: [readingProgressTable.chapter_id],
    references: [chaptersTable.id]
  }),
  page: one(comicPagesTable, {
    fields: [readingProgressTable.page_id],
    references: [comicPagesTable.id]
  })
}));

// TypeScript types for the table schemas
export type Comic = typeof comicsTable.$inferSelect;
export type NewComic = typeof comicsTable.$inferInsert;

export type Chapter = typeof chaptersTable.$inferSelect;
export type NewChapter = typeof chaptersTable.$inferInsert;

export type ComicPage = typeof comicPagesTable.$inferSelect;
export type NewComicPage = typeof comicPagesTable.$inferInsert;

export type ReadingProgress = typeof readingProgressTable.$inferSelect;
export type NewReadingProgress = typeof readingProgressTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  comics: comicsTable,
  chapters: chaptersTable,
  comicPages: comicPagesTable,
  readingProgress: readingProgressTable
};
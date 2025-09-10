import { z } from 'zod';

// Comic schema
export const comicSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  source_url: z.string(), // URL from komiku.org
  status: z.enum(['ongoing', 'completed', 'hiatus']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Comic = z.infer<typeof comicSchema>;

// Chapter schema
export const chapterSchema = z.object({
  id: z.number(),
  comic_id: z.number(),
  chapter_number: z.number(),
  title: z.string(),
  slug: z.string(),
  source_url: z.string(), // URL from komiku.org
  page_count: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Chapter = z.infer<typeof chapterSchema>;

// Comic page schema
export const comicPageSchema = z.object({
  id: z.number(),
  chapter_id: z.number(),
  page_number: z.number().int(),
  image_url: z.string(),
  source_url: z.string(), // Original URL from komiku.org
  ocr_text: z.string().nullable(), // Extracted text from OCR
  ocr_processed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ComicPage = z.infer<typeof comicPageSchema>;

// User reading progress schema
export const readingProgressSchema = z.object({
  id: z.number(),
  user_id: z.string(), // Simple string-based user identification
  comic_id: z.number(),
  chapter_id: z.number(),
  page_id: z.number(),
  last_read_at: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ReadingProgress = z.infer<typeof readingProgressSchema>;

// Input schemas for API operations

// Search comics input
export const searchComicsInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).default(20),
  offset: z.number().int().nonnegative().default(0)
});

export type SearchComicsInput = z.infer<typeof searchComicsInputSchema>;

// Get comic by slug input
export const getComicBySlugInputSchema = z.object({
  slug: z.string()
});

export type GetComicBySlugInput = z.infer<typeof getComicBySlugInputSchema>;

// Get chapters input
export const getChaptersInputSchema = z.object({
  comic_id: z.number().int().positive()
});

export type GetChaptersInput = z.infer<typeof getChaptersInputSchema>;

// Get comic pages input
export const getComicPagesInputSchema = z.object({
  chapter_id: z.number().int().positive()
});

export type GetComicPagesInput = z.infer<typeof getComicPagesInputSchema>;

// Update OCR text input
export const updateOcrTextInputSchema = z.object({
  page_id: z.number().int().positive(),
  ocr_text: z.string()
});

export type UpdateOcrTextInput = z.infer<typeof updateOcrTextInputSchema>;

// Update reading progress input
export const updateReadingProgressInputSchema = z.object({
  user_id: z.string(),
  comic_id: z.number().int().positive(),
  chapter_id: z.number().int().positive(),
  page_id: z.number().int().positive()
});

export type UpdateReadingProgressInput = z.infer<typeof updateReadingProgressInputSchema>;

// Get reading progress input
export const getReadingProgressInputSchema = z.object({
  user_id: z.string(),
  comic_id: z.number().int().positive()
});

export type GetReadingProgressInput = z.infer<typeof getReadingProgressInputSchema>;

// Scrape comic input (for fetching data from komiku.org)
export const scrapeComicInputSchema = z.object({
  comic_url: z.string().url()
});

export type ScrapeComicInput = z.infer<typeof scrapeComicInputSchema>;

// API response schemas

// Comic with chapters
export const comicWithChaptersSchema = z.object({
  ...comicSchema.shape,
  chapters: z.array(chapterSchema)
});

export type ComicWithChapters = z.infer<typeof comicWithChaptersSchema>;

// Chapter with pages
export const chapterWithPagesSchema = z.object({
  ...chapterSchema.shape,
  pages: z.array(comicPageSchema)
});

export type ChapterWithPages = z.infer<typeof chapterWithPagesSchema>;

// Search result
export const searchResultSchema = z.object({
  comics: z.array(comicSchema),
  total_count: z.number().int().nonnegative(),
  has_more: z.boolean()
});

export type SearchResult = z.infer<typeof searchResultSchema>;
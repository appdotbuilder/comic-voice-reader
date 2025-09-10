import { db } from '../db';
import { readingProgressTable, comicsTable, chaptersTable, comicPagesTable } from '../db/schema';
import { type UpdateReadingProgressInput, type ReadingProgress } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function updateReadingProgress(input: UpdateReadingProgressInput): Promise<ReadingProgress> {
  try {
    // First verify that the referenced entities exist to prevent foreign key violations
    const [comicExists, chapterExists, pageExists] = await Promise.all([
      db.select({ id: comicsTable.id })
        .from(comicsTable)
        .where(eq(comicsTable.id, input.comic_id))
        .execute(),
      db.select({ id: chaptersTable.id })
        .from(chaptersTable)
        .where(eq(chaptersTable.id, input.chapter_id))
        .execute(),
      db.select({ id: comicPagesTable.id })
        .from(comicPagesTable)
        .where(eq(comicPagesTable.id, input.page_id))
        .execute()
    ]);

    if (comicExists.length === 0) {
      throw new Error(`Comic with id ${input.comic_id} not found`);
    }
    if (chapterExists.length === 0) {
      throw new Error(`Chapter with id ${input.chapter_id} not found`);
    }
    if (pageExists.length === 0) {
      throw new Error(`Page with id ${input.page_id} not found`);
    }

    // Check if reading progress already exists for this user and comic
    const existingProgress = await db.select()
      .from(readingProgressTable)
      .where(
        and(
          eq(readingProgressTable.user_id, input.user_id),
          eq(readingProgressTable.comic_id, input.comic_id)
        )
      )
      .execute();

    const now = new Date();

    if (existingProgress.length > 0) {
      // Update existing progress
      const updateResult = await db.update(readingProgressTable)
        .set({
          chapter_id: input.chapter_id,
          page_id: input.page_id,
          last_read_at: now,
          updated_at: now
        })
        .where(
          and(
            eq(readingProgressTable.user_id, input.user_id),
            eq(readingProgressTable.comic_id, input.comic_id)
          )
        )
        .returning()
        .execute();

      return updateResult[0];
    } else {
      // Create new progress record
      const insertResult = await db.insert(readingProgressTable)
        .values({
          user_id: input.user_id,
          comic_id: input.comic_id,
          chapter_id: input.chapter_id,
          page_id: input.page_id,
          last_read_at: now,
          created_at: now,
          updated_at: now
        })
        .returning()
        .execute();

      return insertResult[0];
    }
  } catch (error) {
    console.error('Reading progress update failed:', error);
    throw error;
  }
}
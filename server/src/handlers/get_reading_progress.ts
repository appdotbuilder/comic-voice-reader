import { db } from '../db';
import { readingProgressTable } from '../db/schema';
import { type GetReadingProgressInput, type ReadingProgress } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export async function getReadingProgress(input: GetReadingProgressInput): Promise<ReadingProgress | null> {
  try {
    // Get the most recent reading progress for the user and comic
    const results = await db.select()
      .from(readingProgressTable)
      .where(
        and(
          eq(readingProgressTable.user_id, input.user_id),
          eq(readingProgressTable.comic_id, input.comic_id)
        )
      )
      .orderBy(desc(readingProgressTable.last_read_at))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('Failed to get reading progress:', error);
    throw error;
  }
}
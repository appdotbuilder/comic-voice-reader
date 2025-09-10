import { db } from '../db';
import { chaptersTable, comicsTable } from '../db/schema';
import { type GetChaptersInput, type Chapter } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getChapters = async (input: GetChaptersInput): Promise<Chapter[]> => {
  try {
    // Verify comic exists first to provide better error handling
    const comic = await db.select()
      .from(comicsTable)
      .where(eq(comicsTable.id, input.comic_id))
      .limit(1)
      .execute();

    if (comic.length === 0) {
      throw new Error(`Comic with ID ${input.comic_id} not found`);
    }

    // Fetch all chapters for the comic ordered by chapter number
    const chapters = await db.select()
      .from(chaptersTable)
      .where(eq(chaptersTable.comic_id, input.comic_id))
      .orderBy(asc(chaptersTable.chapter_number))
      .execute();

    return chapters;
  } catch (error) {
    console.error('Get chapters failed:', error);
    throw error;
  }
};
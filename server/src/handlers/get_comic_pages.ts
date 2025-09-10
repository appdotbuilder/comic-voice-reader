import { db } from '../db';
import { chaptersTable, comicPagesTable } from '../db/schema';
import { type GetComicPagesInput, type ChapterWithPages } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getComicPages = async (input: GetComicPagesInput): Promise<ChapterWithPages | null> => {
  try {
    // First get the chapter information
    const chapters = await db.select()
      .from(chaptersTable)
      .where(eq(chaptersTable.id, input.chapter_id))
      .execute();

    if (chapters.length === 0) {
      return null;
    }

    const chapter = chapters[0];

    // Get all pages for the chapter, ordered by page number
    const pages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.chapter_id, input.chapter_id))
      .orderBy(asc(comicPagesTable.page_number))
      .execute();

    // Return chapter with pages
    return {
      ...chapter,
      pages: pages
    };
  } catch (error) {
    console.error('Get comic pages failed:', error);
    throw error;
  }
};
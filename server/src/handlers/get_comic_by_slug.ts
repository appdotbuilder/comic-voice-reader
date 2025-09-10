import { db } from '../db';
import { comicsTable, chaptersTable } from '../db/schema';
import { type GetComicBySlugInput, type ComicWithChapters } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getComicBySlug(input: GetComicBySlugInput): Promise<ComicWithChapters | null> {
  try {
    // First, find the comic by slug
    const comics = await db.select()
      .from(comicsTable)
      .where(eq(comicsTable.slug, input.slug))
      .execute();

    if (comics.length === 0) {
      return null;
    }

    const comic = comics[0];

    // Get all chapters for this comic, ordered by chapter number
    const chapters = await db.select()
      .from(chaptersTable)
      .where(eq(chaptersTable.comic_id, comic.id))
      .orderBy(asc(chaptersTable.chapter_number))
      .execute();

    // Return comic with chapters
    return {
      ...comic,
      chapters: chapters
    };
  } catch (error) {
    console.error('Failed to get comic by slug:', error);
    throw error;
  }
}
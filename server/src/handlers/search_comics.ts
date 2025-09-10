import { db } from '../db';
import { comicsTable } from '../db/schema';
import { type SearchComicsInput, type SearchResult } from '../schema';
import { ilike, or, sql, count } from 'drizzle-orm';

export async function searchComics(input: SearchComicsInput): Promise<SearchResult> {
  try {
    // Build search conditions - search in title and description
    const searchPattern = `%${input.query}%`;
    const searchConditions = or(
      ilike(comicsTable.title, searchPattern),
      ilike(comicsTable.description, searchPattern)
    );

    // Get total count for pagination
    const countResult = await db
      .select({ count: count() })
      .from(comicsTable)
      .where(searchConditions)
      .execute();

    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    const comics = await db
      .select()
      .from(comicsTable)
      .where(searchConditions)
      .orderBy(comicsTable.title)
      .limit(input.limit)
      .offset(input.offset)
      .execute();

    // Calculate if there are more results
    const hasMore = input.offset + input.limit < totalCount;

    return {
      comics,
      total_count: totalCount,
      has_more: hasMore
    };
  } catch (error) {
    console.error('Comic search failed:', error);
    throw error;
  }
}
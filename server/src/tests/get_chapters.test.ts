import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable, chaptersTable } from '../db/schema';
import { type GetChaptersInput } from '../schema';
import { getChapters } from '../handlers/get_chapters';

describe('getChapters', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return chapters ordered by chapter number', async () => {
    // Create test comic
    const comicResult = await db.insert(comicsTable)
      .values({
        title: 'Test Comic',
        slug: 'test-comic',
        source_url: 'https://komiku.org/manga/test-comic/'
      })
      .returning()
      .execute();

    const comic = comicResult[0];

    // Create chapters in non-sequential order
    await db.insert(chaptersTable)
      .values([
        {
          comic_id: comic.id,
          chapter_number: 3,
          title: 'Chapter 3',
          slug: 'chapter-3',
          source_url: 'https://komiku.org/manga/test-comic/chapter-3/',
          page_count: 20
        },
        {
          comic_id: comic.id,
          chapter_number: 1,
          title: 'Chapter 1',
          slug: 'chapter-1',
          source_url: 'https://komiku.org/manga/test-comic/chapter-1/',
          page_count: 15
        },
        {
          comic_id: comic.id,
          chapter_number: 2,
          title: 'Chapter 2',
          slug: 'chapter-2',
          source_url: 'https://komiku.org/manga/test-comic/chapter-2/',
          page_count: 18
        }
      ])
      .execute();

    const input: GetChaptersInput = {
      comic_id: comic.id
    };

    const result = await getChapters(input);

    // Verify chapters are returned in order
    expect(result).toHaveLength(3);
    expect(result[0].chapter_number).toEqual(1);
    expect(result[0].title).toEqual('Chapter 1');
    expect(result[0].comic_id).toEqual(comic.id);
    expect(result[0].slug).toEqual('chapter-1');
    expect(result[0].source_url).toEqual('https://komiku.org/manga/test-comic/chapter-1/');
    expect(result[0].page_count).toEqual(15);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[1].chapter_number).toEqual(2);
    expect(result[1].title).toEqual('Chapter 2');

    expect(result[2].chapter_number).toEqual(3);
    expect(result[2].title).toEqual('Chapter 3');
  });

  it('should return empty array for comic with no chapters', async () => {
    // Create comic without chapters
    const comicResult = await db.insert(comicsTable)
      .values({
        title: 'Empty Comic',
        slug: 'empty-comic',
        source_url: 'https://komiku.org/manga/empty-comic/'
      })
      .returning()
      .execute();

    const comic = comicResult[0];

    const input: GetChaptersInput = {
      comic_id: comic.id
    };

    const result = await getChapters(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should throw error for non-existent comic', async () => {
    const input: GetChaptersInput = {
      comic_id: 99999 // Non-existent comic ID
    };

    await expect(getChapters(input)).rejects.toThrow(/Comic with ID 99999 not found/i);
  });

  it('should handle chapters with decimal chapter numbers correctly', async () => {
    // Create test comic
    const comicResult = await db.insert(comicsTable)
      .values({
        title: 'Decimal Chapter Comic',
        slug: 'decimal-chapter-comic',
        source_url: 'https://komiku.org/manga/decimal-comic/'
      })
      .returning()
      .execute();

    const comic = comicResult[0];

    // Create chapters with decimal-like numbers (stored as integers for simplicity)
    await db.insert(chaptersTable)
      .values([
        {
          comic_id: comic.id,
          chapter_number: 15, // Chapter 1.5
          title: 'Chapter 1.5',
          slug: 'chapter-1-5',
          source_url: 'https://komiku.org/manga/decimal-comic/chapter-1-5/',
          page_count: 10
        },
        {
          comic_id: comic.id,
          chapter_number: 10, // Chapter 1
          title: 'Chapter 1',
          slug: 'chapter-1',
          source_url: 'https://komiku.org/manga/decimal-comic/chapter-1/',
          page_count: 20
        },
        {
          comic_id: comic.id,
          chapter_number: 20, // Chapter 2
          title: 'Chapter 2',
          slug: 'chapter-2',
          source_url: 'https://komiku.org/manga/decimal-comic/chapter-2/',
          page_count: 25
        }
      ])
      .execute();

    const input: GetChaptersInput = {
      comic_id: comic.id
    };

    const result = await getChapters(input);

    expect(result).toHaveLength(3);
    expect(result[0].chapter_number).toEqual(10);
    expect(result[1].chapter_number).toEqual(15);
    expect(result[2].chapter_number).toEqual(20);
  });

  it('should only return chapters for specified comic', async () => {
    // Create two different comics
    const comic1Result = await db.insert(comicsTable)
      .values({
        title: 'Comic 1',
        slug: 'comic-1',
        source_url: 'https://komiku.org/manga/comic-1/'
      })
      .returning()
      .execute();

    const comic2Result = await db.insert(comicsTable)
      .values({
        title: 'Comic 2',
        slug: 'comic-2',
        source_url: 'https://komiku.org/manga/comic-2/'
      })
      .returning()
      .execute();

    const comic1 = comic1Result[0];
    const comic2 = comic2Result[0];

    // Create chapters for both comics
    await db.insert(chaptersTable)
      .values([
        {
          comic_id: comic1.id,
          chapter_number: 1,
          title: 'Comic 1 - Chapter 1',
          slug: 'comic-1-chapter-1',
          source_url: 'https://komiku.org/manga/comic-1/chapter-1/',
          page_count: 10
        },
        {
          comic_id: comic1.id,
          chapter_number: 2,
          title: 'Comic 1 - Chapter 2',
          slug: 'comic-1-chapter-2',
          source_url: 'https://komiku.org/manga/comic-1/chapter-2/',
          page_count: 12
        },
        {
          comic_id: comic2.id,
          chapter_number: 1,
          title: 'Comic 2 - Chapter 1',
          slug: 'comic-2-chapter-1',
          source_url: 'https://komiku.org/manga/comic-2/chapter-1/',
          page_count: 15
        }
      ])
      .execute();

    const input: GetChaptersInput = {
      comic_id: comic1.id
    };

    const result = await getChapters(input);

    // Should only return chapters for comic1
    expect(result).toHaveLength(2);
    expect(result[0].comic_id).toEqual(comic1.id);
    expect(result[0].title).toEqual('Comic 1 - Chapter 1');
    expect(result[1].comic_id).toEqual(comic1.id);
    expect(result[1].title).toEqual('Comic 1 - Chapter 2');
  });
});
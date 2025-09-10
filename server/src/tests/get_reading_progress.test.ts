import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable, chaptersTable, comicPagesTable, readingProgressTable } from '../db/schema';
import { type GetReadingProgressInput } from '../schema';
import { getReadingProgress } from '../handlers/get_reading_progress';

// Test input
const testInput: GetReadingProgressInput = {
  user_id: 'user123',
  comic_id: 1
};

describe('getReadingProgress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when no progress exists', async () => {
    const result = await getReadingProgress(testInput);
    expect(result).toBeNull();
  });

  it('should return reading progress when it exists', async () => {
    // Create prerequisite data
    const comic = await db.insert(comicsTable)
      .values({
        title: 'Test Comic',
        slug: 'test-comic',
        description: 'A test comic',
        source_url: 'https://komiku.org/test-comic',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const chapter = await db.insert(chaptersTable)
      .values({
        comic_id: comic[0].id,
        chapter_number: 1,
        title: 'Chapter 1',
        slug: 'chapter-1',
        source_url: 'https://komiku.org/test-comic/chapter-1',
        page_count: 10
      })
      .returning()
      .execute();

    const page = await db.insert(comicPagesTable)
      .values({
        chapter_id: chapter[0].id,
        page_number: 5,
        image_url: 'https://example.com/page5.jpg',
        source_url: 'https://komiku.org/test-comic/chapter-1/page-5'
      })
      .returning()
      .execute();

    // Create reading progress
    const progress = await db.insert(readingProgressTable)
      .values({
        user_id: 'user123',
        comic_id: comic[0].id,
        chapter_id: chapter[0].id,
        page_id: page[0].id
      })
      .returning()
      .execute();

    const result = await getReadingProgress({
      user_id: 'user123',
      comic_id: comic[0].id
    });

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(progress[0].id);
    expect(result!.user_id).toEqual('user123');
    expect(result!.comic_id).toEqual(comic[0].id);
    expect(result!.chapter_id).toEqual(chapter[0].id);
    expect(result!.page_id).toEqual(page[0].id);
    expect(result!.last_read_at).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for different user', async () => {
    // Create prerequisite data
    const comic = await db.insert(comicsTable)
      .values({
        title: 'Test Comic',
        slug: 'test-comic',
        description: 'A test comic',
        source_url: 'https://komiku.org/test-comic',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const chapter = await db.insert(chaptersTable)
      .values({
        comic_id: comic[0].id,
        chapter_number: 1,
        title: 'Chapter 1',
        slug: 'chapter-1',
        source_url: 'https://komiku.org/test-comic/chapter-1',
        page_count: 10
      })
      .returning()
      .execute();

    const page = await db.insert(comicPagesTable)
      .values({
        chapter_id: chapter[0].id,
        page_number: 5,
        image_url: 'https://example.com/page5.jpg',
        source_url: 'https://komiku.org/test-comic/chapter-1/page-5'
      })
      .returning()
      .execute();

    // Create reading progress for user123
    await db.insert(readingProgressTable)
      .values({
        user_id: 'user123',
        comic_id: comic[0].id,
        chapter_id: chapter[0].id,
        page_id: page[0].id
      })
      .returning()
      .execute();

    // Query with different user
    const result = await getReadingProgress({
      user_id: 'user456',
      comic_id: comic[0].id
    });

    expect(result).toBeNull();
  });

  it('should return null for different comic', async () => {
    // Create prerequisite data for comic 1
    const comic1 = await db.insert(comicsTable)
      .values({
        title: 'Test Comic 1',
        slug: 'test-comic-1',
        description: 'A test comic',
        source_url: 'https://komiku.org/test-comic-1',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const comic2 = await db.insert(comicsTable)
      .values({
        title: 'Test Comic 2',
        slug: 'test-comic-2',
        description: 'Another test comic',
        source_url: 'https://komiku.org/test-comic-2',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const chapter = await db.insert(chaptersTable)
      .values({
        comic_id: comic1[0].id,
        chapter_number: 1,
        title: 'Chapter 1',
        slug: 'chapter-1',
        source_url: 'https://komiku.org/test-comic-1/chapter-1',
        page_count: 10
      })
      .returning()
      .execute();

    const page = await db.insert(comicPagesTable)
      .values({
        chapter_id: chapter[0].id,
        page_number: 5,
        image_url: 'https://example.com/page5.jpg',
        source_url: 'https://komiku.org/test-comic-1/chapter-1/page-5'
      })
      .returning()
      .execute();

    // Create reading progress for comic 1
    await db.insert(readingProgressTable)
      .values({
        user_id: 'user123',
        comic_id: comic1[0].id,
        chapter_id: chapter[0].id,
        page_id: page[0].id
      })
      .returning()
      .execute();

    // Query for comic 2
    const result = await getReadingProgress({
      user_id: 'user123',
      comic_id: comic2[0].id
    });

    expect(result).toBeNull();
  });

  it('should return most recent progress when multiple entries exist', async () => {
    // Create prerequisite data
    const comic = await db.insert(comicsTable)
      .values({
        title: 'Test Comic',
        slug: 'test-comic',
        description: 'A test comic',
        source_url: 'https://komiku.org/test-comic',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const chapter = await db.insert(chaptersTable)
      .values({
        comic_id: comic[0].id,
        chapter_number: 1,
        title: 'Chapter 1',
        slug: 'chapter-1',
        source_url: 'https://komiku.org/test-comic/chapter-1',
        page_count: 10
      })
      .returning()
      .execute();

    const page1 = await db.insert(comicPagesTable)
      .values({
        chapter_id: chapter[0].id,
        page_number: 1,
        image_url: 'https://example.com/page1.jpg',
        source_url: 'https://komiku.org/test-comic/chapter-1/page-1'
      })
      .returning()
      .execute();

    const page2 = await db.insert(comicPagesTable)
      .values({
        chapter_id: chapter[0].id,
        page_number: 2,
        image_url: 'https://example.com/page2.jpg',
        source_url: 'https://komiku.org/test-comic/chapter-1/page-2'
      })
      .returning()
      .execute();

    // Create first progress entry (older)
    const oldDate = new Date('2024-01-01');
    await db.insert(readingProgressTable)
      .values({
        user_id: 'user123',
        comic_id: comic[0].id,
        chapter_id: chapter[0].id,
        page_id: page1[0].id,
        last_read_at: oldDate
      })
      .execute();

    // Create second progress entry (newer) 
    const newDate = new Date('2024-01-02');
    const recentProgress = await db.insert(readingProgressTable)
      .values({
        user_id: 'user123',
        comic_id: comic[0].id,
        chapter_id: chapter[0].id,
        page_id: page2[0].id,
        last_read_at: newDate
      })
      .returning()
      .execute();

    const result = await getReadingProgress({
      user_id: 'user123',
      comic_id: comic[0].id
    });

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(recentProgress[0].id);
    expect(result!.page_id).toEqual(page2[0].id);
    expect(result!.last_read_at).toEqual(newDate);
  });

  it('should handle non-existent comic_id gracefully', async () => {
    const result = await getReadingProgress({
      user_id: 'user123',
      comic_id: 999999 // Non-existent comic ID
    });

    expect(result).toBeNull();
  });
});
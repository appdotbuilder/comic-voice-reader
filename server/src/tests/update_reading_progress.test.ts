import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable, chaptersTable, comicPagesTable, readingProgressTable } from '../db/schema';
import { type UpdateReadingProgressInput } from '../schema';
import { updateReadingProgress } from '../handlers/update_reading_progress';
import { eq, and } from 'drizzle-orm';

// Test data setup
const testComic = {
  title: 'Test Comic',
  slug: 'test-comic',
  description: 'A test comic for reading progress',
  thumbnail_url: 'https://example.com/thumb.jpg',
  source_url: 'https://komiku.org/test-comic',
  status: 'ongoing' as const
};

const testChapter = {
  chapter_number: 1,
  title: 'Chapter 1',
  slug: 'chapter-1',
  source_url: 'https://komiku.org/test-comic/chapter-1',
  page_count: 10
};

const testPage = {
  page_number: 5,
  image_url: 'https://example.com/page5.jpg',
  source_url: 'https://komiku.org/test-comic/chapter-1/page-5',
  ocr_text: 'Test OCR text'
};

const testInput: UpdateReadingProgressInput = {
  user_id: 'test-user-123',
  comic_id: 1, // Will be set after comic creation
  chapter_id: 1, // Will be set after chapter creation
  page_id: 1 // Will be set after page creation
};

describe('updateReadingProgress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let comicId: number;
  let chapterId: number;
  let pageId: number;

  beforeEach(async () => {
    // Create prerequisite data
    const comic = await db.insert(comicsTable)
      .values(testComic)
      .returning()
      .execute();
    comicId = comic[0].id;

    const chapter = await db.insert(chaptersTable)
      .values({ ...testChapter, comic_id: comicId })
      .returning()
      .execute();
    chapterId = chapter[0].id;

    const page = await db.insert(comicPagesTable)
      .values({ ...testPage, chapter_id: chapterId })
      .returning()
      .execute();
    pageId = page[0].id;

    // Update test input with actual IDs
    testInput.comic_id = comicId;
    testInput.chapter_id = chapterId;
    testInput.page_id = pageId;
  });

  it('should create new reading progress when none exists', async () => {
    const result = await updateReadingProgress(testInput);

    // Verify returned data
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual('test-user-123');
    expect(result.comic_id).toEqual(comicId);
    expect(result.chapter_id).toEqual(chapterId);
    expect(result.page_id).toEqual(pageId);
    expect(result.last_read_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save reading progress to database', async () => {
    const result = await updateReadingProgress(testInput);

    // Verify data is saved in database
    const progress = await db.select()
      .from(readingProgressTable)
      .where(eq(readingProgressTable.id, result.id))
      .execute();

    expect(progress).toHaveLength(1);
    expect(progress[0].user_id).toEqual('test-user-123');
    expect(progress[0].comic_id).toEqual(comicId);
    expect(progress[0].chapter_id).toEqual(chapterId);
    expect(progress[0].page_id).toEqual(pageId);
    expect(progress[0].last_read_at).toBeInstanceOf(Date);
  });

  it('should update existing reading progress', async () => {
    // Create initial progress
    const firstResult = await updateReadingProgress(testInput);

    // Create another page for the same chapter
    const secondPage = await db.insert(comicPagesTable)
      .values({
        ...testPage,
        chapter_id: chapterId,
        page_number: 6,
        image_url: 'https://example.com/page6.jpg',
        source_url: 'https://komiku.org/test-comic/chapter-1/page-6'
      })
      .returning()
      .execute();

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update progress to second page
    const updateInput = {
      ...testInput,
      page_id: secondPage[0].id
    };

    const secondResult = await updateReadingProgress(updateInput);

    // Should have same ID (updated, not created)
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.page_id).toEqual(secondPage[0].id);
    expect(secondResult.updated_at.getTime()).toBeGreaterThan(firstResult.updated_at.getTime());

    // Verify only one record exists for this user-comic combination
    const allProgress = await db.select()
      .from(readingProgressTable)
      .where(
        and(
          eq(readingProgressTable.user_id, 'test-user-123'),
          eq(readingProgressTable.comic_id, comicId)
        )
      )
      .execute();

    expect(allProgress).toHaveLength(1);
    expect(allProgress[0].page_id).toEqual(secondPage[0].id);
  });

  it('should handle different users for same comic', async () => {
    // Create progress for first user
    const firstUserResult = await updateReadingProgress(testInput);

    // Create progress for second user
    const secondUserInput = {
      ...testInput,
      user_id: 'test-user-456'
    };
    const secondUserResult = await updateReadingProgress(secondUserInput);

    // Should be different records
    expect(firstUserResult.id).not.toEqual(secondUserResult.id);
    expect(firstUserResult.user_id).toEqual('test-user-123');
    expect(secondUserResult.user_id).toEqual('test-user-456');

    // Verify both records exist in database
    const allProgress = await db.select()
      .from(readingProgressTable)
      .where(eq(readingProgressTable.comic_id, comicId))
      .execute();

    expect(allProgress).toHaveLength(2);
  });

  it('should throw error when comic does not exist', async () => {
    const invalidInput = {
      ...testInput,
      comic_id: 99999
    };

    await expect(updateReadingProgress(invalidInput))
      .rejects.toThrow(/comic with id 99999 not found/i);
  });

  it('should throw error when chapter does not exist', async () => {
    const invalidInput = {
      ...testInput,
      chapter_id: 99999
    };

    await expect(updateReadingProgress(invalidInput))
      .rejects.toThrow(/chapter with id 99999 not found/i);
  });

  it('should throw error when page does not exist', async () => {
    const invalidInput = {
      ...testInput,
      page_id: 99999
    };

    await expect(updateReadingProgress(invalidInput))
      .rejects.toThrow(/page with id 99999 not found/i);
  });

  it('should update last_read_at timestamp correctly', async () => {
    const beforeTime = new Date();
    
    const result = await updateReadingProgress(testInput);
    
    const afterTime = new Date();

    expect(result.last_read_at.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(result.last_read_at.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('should handle same page update correctly', async () => {
    // Create initial progress
    const firstResult = await updateReadingProgress(testInput);

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update with same page (user re-opened same page)
    const secondResult = await updateReadingProgress(testInput);

    // Should update the same record
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.page_id).toEqual(firstResult.page_id);
    expect(secondResult.updated_at.getTime()).toBeGreaterThan(firstResult.updated_at.getTime());
    expect(secondResult.last_read_at.getTime()).toBeGreaterThan(firstResult.last_read_at.getTime());
  });
});
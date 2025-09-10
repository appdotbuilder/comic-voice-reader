import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable, chaptersTable, comicPagesTable } from '../db/schema';
import { type UpdateOcrTextInput } from '../schema';
import { updateOcrText } from '../handlers/update_ocr_text';
import { eq } from 'drizzle-orm';

// Test data setup
const testComic = {
  title: 'Test Comic',
  slug: 'test-comic',
  description: 'A comic for testing',
  thumbnail_url: 'https://example.com/thumbnail.jpg',
  source_url: 'https://komiku.org/test-comic',
  status: 'ongoing' as const
};

const testChapter = {
  chapter_number: 1,
  title: 'Chapter 1: Beginning',
  slug: 'chapter-1-beginning',
  source_url: 'https://komiku.org/test-comic/chapter-1',
  page_count: 20
};

const testPage = {
  page_number: 1,
  image_url: 'https://example.com/page1.jpg',
  source_url: 'https://komiku.org/test-comic/chapter-1/page-1',
  ocr_text: null,
  ocr_processed_at: null
};

describe('updateOcrText', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update OCR text for an existing page', async () => {
    // Create prerequisite data
    const [comic] = await db.insert(comicsTable)
      .values(testComic)
      .returning()
      .execute();

    const [chapter] = await db.insert(chaptersTable)
      .values({
        ...testChapter,
        comic_id: comic.id
      })
      .returning()
      .execute();

    const [page] = await db.insert(comicPagesTable)
      .values({
        ...testPage,
        chapter_id: chapter.id
      })
      .returning()
      .execute();

    // Test input
    const testInput: UpdateOcrTextInput = {
      page_id: page.id,
      ocr_text: 'This is the extracted OCR text from the page image.'
    };

    const result = await updateOcrText(testInput);

    // Verify the response
    expect(result.id).toEqual(page.id);
    expect(result.ocr_text).toEqual(testInput.ocr_text);
    expect(result.ocr_processed_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.chapter_id).toEqual(chapter.id);
    expect(result.page_number).toEqual(testPage.page_number);
    expect(result.image_url).toEqual(testPage.image_url);
    expect(result.source_url).toEqual(testPage.source_url);
  });

  it('should save OCR text to database', async () => {
    // Create prerequisite data
    const [comic] = await db.insert(comicsTable)
      .values(testComic)
      .returning()
      .execute();

    const [chapter] = await db.insert(chaptersTable)
      .values({
        ...testChapter,
        comic_id: comic.id
      })
      .returning()
      .execute();

    const [page] = await db.insert(comicPagesTable)
      .values({
        ...testPage,
        chapter_id: chapter.id
      })
      .returning()
      .execute();

    const testInput: UpdateOcrTextInput = {
      page_id: page.id,
      ocr_text: 'OCR extracted text content'
    };

    await updateOcrText(testInput);

    // Verify data was saved to database
    const updatedPages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.id, page.id))
      .execute();

    expect(updatedPages).toHaveLength(1);
    const updatedPage = updatedPages[0];
    
    expect(updatedPage.ocr_text).toEqual(testInput.ocr_text);
    expect(updatedPage.ocr_processed_at).toBeInstanceOf(Date);
    expect(updatedPage.updated_at).toBeInstanceOf(Date);
    expect(updatedPage.ocr_processed_at!.getTime()).toBeGreaterThan(page.created_at.getTime());
  });

  it('should update existing OCR text', async () => {
    // Create prerequisite data with existing OCR text
    const [comic] = await db.insert(comicsTable)
      .values(testComic)
      .returning()
      .execute();

    const [chapter] = await db.insert(chaptersTable)
      .values({
        ...testChapter,
        comic_id: comic.id
      })
      .returning()
      .execute();

    const existingOcrDate = new Date('2024-01-01');
    const [page] = await db.insert(comicPagesTable)
      .values({
        ...testPage,
        chapter_id: chapter.id,
        ocr_text: 'Old OCR text',
        ocr_processed_at: existingOcrDate
      })
      .returning()
      .execute();

    const testInput: UpdateOcrTextInput = {
      page_id: page.id,
      ocr_text: 'Updated OCR text with better accuracy'
    };

    const result = await updateOcrText(testInput);

    // Verify the OCR text was updated
    expect(result.ocr_text).toEqual(testInput.ocr_text);
    expect(result.ocr_processed_at).toBeInstanceOf(Date);
    expect(result.ocr_processed_at!.getTime()).toBeGreaterThan(existingOcrDate.getTime());

    // Verify in database
    const updatedPages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.id, page.id))
      .execute();

    const updatedPage = updatedPages[0];
    expect(updatedPage.ocr_text).toEqual(testInput.ocr_text);
    expect(updatedPage.ocr_processed_at!.getTime()).toBeGreaterThan(existingOcrDate.getTime());
  });

  it('should handle empty OCR text', async () => {
    // Create prerequisite data
    const [comic] = await db.insert(comicsTable)
      .values(testComic)
      .returning()
      .execute();

    const [chapter] = await db.insert(chaptersTable)
      .values({
        ...testChapter,
        comic_id: comic.id
      })
      .returning()
      .execute();

    const [page] = await db.insert(comicPagesTable)
      .values({
        ...testPage,
        chapter_id: chapter.id
      })
      .returning()
      .execute();

    const testInput: UpdateOcrTextInput = {
      page_id: page.id,
      ocr_text: '' // Empty string
    };

    const result = await updateOcrText(testInput);

    expect(result.ocr_text).toEqual('');
    expect(result.ocr_processed_at).toBeInstanceOf(Date);

    // Verify in database
    const updatedPages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.id, page.id))
      .execute();

    expect(updatedPages[0].ocr_text).toEqual('');
  });

  it('should throw error for non-existent page', async () => {
    const testInput: UpdateOcrTextInput = {
      page_id: 99999, // Non-existent page ID
      ocr_text: 'Some OCR text'
    };

    await expect(updateOcrText(testInput)).rejects.toThrow(/page with id 99999 not found/i);
  });

  it('should handle long OCR text content', async () => {
    // Create prerequisite data
    const [comic] = await db.insert(comicsTable)
      .values(testComic)
      .returning()
      .execute();

    const [chapter] = await db.insert(chaptersTable)
      .values({
        ...testChapter,
        comic_id: comic.id
      })
      .returning()
      .execute();

    const [page] = await db.insert(comicPagesTable)
      .values({
        ...testPage,
        chapter_id: chapter.id
      })
      .returning()
      .execute();

    // Generate a long OCR text (simulating a page with lots of text)
    const longOcrText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);

    const testInput: UpdateOcrTextInput = {
      page_id: page.id,
      ocr_text: longOcrText
    };

    const result = await updateOcrText(testInput);

    expect(result.ocr_text).toEqual(longOcrText);
    expect(result.ocr_text!.length).toBeGreaterThan(1000);

    // Verify in database
    const updatedPages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.id, page.id))
      .execute();

    expect(updatedPages[0].ocr_text).toEqual(longOcrText);
  });
});
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable, chaptersTable, comicPagesTable } from '../db/schema';
import { type GetComicPagesInput } from '../schema';
import { getComicPages } from '../handlers/get_comic_pages';
import { eq } from 'drizzle-orm';

describe('getComicPages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return chapter with pages ordered by page number', async () => {
    // Create test comic
    const [comic] = await db.insert(comicsTable)
      .values({
        title: 'Test Comic',
        slug: 'test-comic',
        source_url: 'https://komiku.org/manga/test-comic',
        status: 'ongoing'
      })
      .returning()
      .execute();

    // Create test chapter
    const [chapter] = await db.insert(chaptersTable)
      .values({
        comic_id: comic.id,
        chapter_number: 1,
        title: 'Chapter 1',
        slug: 'chapter-1',
        source_url: 'https://komiku.org/manga/test-comic/chapter-1',
        page_count: 3
      })
      .returning()
      .execute();

    // Create test pages (insert in random order to test ordering)
    const pages = [
      {
        chapter_id: chapter.id,
        page_number: 3,
        image_url: 'https://example.com/page3.jpg',
        source_url: 'https://komiku.org/page3',
        ocr_text: 'Page 3 text'
      },
      {
        chapter_id: chapter.id,
        page_number: 1,
        image_url: 'https://example.com/page1.jpg',
        source_url: 'https://komiku.org/page1',
        ocr_text: null
      },
      {
        chapter_id: chapter.id,
        page_number: 2,
        image_url: 'https://example.com/page2.jpg',
        source_url: 'https://komiku.org/page2',
        ocr_text: 'Page 2 text'
      }
    ];

    await db.insert(comicPagesTable)
      .values(pages)
      .execute();

    const input: GetComicPagesInput = {
      chapter_id: chapter.id
    };

    const result = await getComicPages(input);

    // Verify chapter information
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(chapter.id);
    expect(result!.comic_id).toEqual(comic.id);
    expect(result!.chapter_number).toEqual(1);
    expect(result!.title).toEqual('Chapter 1');
    expect(result!.slug).toEqual('chapter-1');
    expect(result!.source_url).toEqual('https://komiku.org/manga/test-comic/chapter-1');
    expect(result!.page_count).toEqual(3);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Verify pages are included and ordered correctly
    expect(result!.pages).toHaveLength(3);
    
    // Check page ordering (should be 1, 2, 3)
    expect(result!.pages[0].page_number).toEqual(1);
    expect(result!.pages[1].page_number).toEqual(2);
    expect(result!.pages[2].page_number).toEqual(3);

    // Verify page details
    expect(result!.pages[0].image_url).toEqual('https://example.com/page1.jpg');
    expect(result!.pages[0].source_url).toEqual('https://komiku.org/page1');
    expect(result!.pages[0].ocr_text).toBeNull();

    expect(result!.pages[1].image_url).toEqual('https://example.com/page2.jpg');
    expect(result!.pages[1].source_url).toEqual('https://komiku.org/page2');
    expect(result!.pages[1].ocr_text).toEqual('Page 2 text');

    expect(result!.pages[2].image_url).toEqual('https://example.com/page3.jpg');
    expect(result!.pages[2].source_url).toEqual('https://komiku.org/page3');
    expect(result!.pages[2].ocr_text).toEqual('Page 3 text');

    // Verify all pages have required timestamps
    result!.pages.forEach(page => {
      expect(page.created_at).toBeInstanceOf(Date);
      expect(page.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return chapter with empty pages array when no pages exist', async () => {
    // Create test comic
    const [comic] = await db.insert(comicsTable)
      .values({
        title: 'Test Comic',
        slug: 'test-comic',
        source_url: 'https://komiku.org/manga/test-comic',
        status: 'ongoing'
      })
      .returning()
      .execute();

    // Create test chapter with no pages
    const [chapter] = await db.insert(chaptersTable)
      .values({
        comic_id: comic.id,
        chapter_number: 1,
        title: 'Empty Chapter',
        slug: 'empty-chapter',
        source_url: 'https://komiku.org/manga/test-comic/empty-chapter',
        page_count: 0
      })
      .returning()
      .execute();

    const input: GetComicPagesInput = {
      chapter_id: chapter.id
    };

    const result = await getComicPages(input);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(chapter.id);
    expect(result!.title).toEqual('Empty Chapter');
    expect(result!.pages).toHaveLength(0);
  });

  it('should return null when chapter does not exist', async () => {
    const input: GetComicPagesInput = {
      chapter_id: 999999
    };

    const result = await getComicPages(input);

    expect(result).toBeNull();
  });

  it('should handle chapters with OCR processing timestamps', async () => {
    // Create test comic and chapter
    const [comic] = await db.insert(comicsTable)
      .values({
        title: 'OCR Test Comic',
        slug: 'ocr-test-comic',
        source_url: 'https://komiku.org/manga/ocr-test',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const [chapter] = await db.insert(chaptersTable)
      .values({
        comic_id: comic.id,
        chapter_number: 1,
        title: 'OCR Chapter',
        slug: 'ocr-chapter',
        source_url: 'https://komiku.org/manga/ocr-test/chapter-1',
        page_count: 1
      })
      .returning()
      .execute();

    // Create page with OCR processing timestamp
    const ocrProcessedTime = new Date('2024-01-15T10:30:00Z');
    await db.insert(comicPagesTable)
      .values({
        chapter_id: chapter.id,
        page_number: 1,
        image_url: 'https://example.com/ocr-page.jpg',
        source_url: 'https://komiku.org/ocr-page',
        ocr_text: 'Extracted OCR text',
        ocr_processed_at: ocrProcessedTime
      })
      .execute();

    const input: GetComicPagesInput = {
      chapter_id: chapter.id
    };

    const result = await getComicPages(input);

    expect(result).not.toBeNull();
    expect(result!.pages).toHaveLength(1);
    expect(result!.pages[0].ocr_text).toEqual('Extracted OCR text');
    expect(result!.pages[0].ocr_processed_at).toBeInstanceOf(Date);
    expect(result!.pages[0].ocr_processed_at!.toISOString()).toEqual(ocrProcessedTime.toISOString());
  });

  it('should correctly handle large number of pages', async () => {
    // Create test comic and chapter
    const [comic] = await db.insert(comicsTable)
      .values({
        title: 'Long Comic',
        slug: 'long-comic',
        source_url: 'https://komiku.org/manga/long-comic',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const [chapter] = await db.insert(chaptersTable)
      .values({
        comic_id: comic.id,
        chapter_number: 1,
        title: 'Long Chapter',
        slug: 'long-chapter',
        source_url: 'https://komiku.org/manga/long-comic/chapter-1',
        page_count: 25
      })
      .returning()
      .execute();

    // Create 25 pages
    const pages = Array.from({ length: 25 }, (_, index) => ({
      chapter_id: chapter.id,
      page_number: index + 1,
      image_url: `https://example.com/page${index + 1}.jpg`,
      source_url: `https://komiku.org/page${index + 1}`,
      ocr_text: `Page ${index + 1} content`
    }));

    await db.insert(comicPagesTable)
      .values(pages)
      .execute();

    const input: GetComicPagesInput = {
      chapter_id: chapter.id
    };

    const result = await getComicPages(input);

    expect(result).not.toBeNull();
    expect(result!.pages).toHaveLength(25);

    // Verify ordering is correct for all pages
    result!.pages.forEach((page, index) => {
      expect(page.page_number).toEqual(index + 1);
      expect(page.image_url).toEqual(`https://example.com/page${index + 1}.jpg`);
      expect(page.ocr_text).toEqual(`Page ${index + 1} content`);
    });
  });

  it('should verify pages belong to correct chapter', async () => {
    // Create two comics and chapters
    const [comic1] = await db.insert(comicsTable)
      .values({
        title: 'Comic 1',
        slug: 'comic-1',
        source_url: 'https://komiku.org/manga/comic-1',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const [comic2] = await db.insert(comicsTable)
      .values({
        title: 'Comic 2',
        slug: 'comic-2',
        source_url: 'https://komiku.org/manga/comic-2',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const [chapter1] = await db.insert(chaptersTable)
      .values({
        comic_id: comic1.id,
        chapter_number: 1,
        title: 'Chapter 1-1',
        slug: 'chapter-1-1',
        source_url: 'https://komiku.org/manga/comic-1/chapter-1',
        page_count: 2
      })
      .returning()
      .execute();

    const [chapter2] = await db.insert(chaptersTable)
      .values({
        comic_id: comic2.id,
        chapter_number: 1,
        title: 'Chapter 2-1',
        slug: 'chapter-2-1',
        source_url: 'https://komiku.org/manga/comic-2/chapter-1',
        page_count: 2
      })
      .returning()
      .execute();

    // Create pages for both chapters
    await db.insert(comicPagesTable)
      .values([
        {
          chapter_id: chapter1.id,
          page_number: 1,
          image_url: 'https://example.com/c1-p1.jpg',
          source_url: 'https://komiku.org/c1-p1'
        },
        {
          chapter_id: chapter1.id,
          page_number: 2,
          image_url: 'https://example.com/c1-p2.jpg',
          source_url: 'https://komiku.org/c1-p2'
        },
        {
          chapter_id: chapter2.id,
          page_number: 1,
          image_url: 'https://example.com/c2-p1.jpg',
          source_url: 'https://komiku.org/c2-p1'
        }
      ])
      .execute();

    // Get pages for chapter1 - should only return chapter1's pages
    const input1: GetComicPagesInput = {
      chapter_id: chapter1.id
    };

    const result1 = await getComicPages(input1);

    expect(result1).not.toBeNull();
    expect(result1!.id).toEqual(chapter1.id);
    expect(result1!.title).toEqual('Chapter 1-1');
    expect(result1!.pages).toHaveLength(2);
    expect(result1!.pages[0].image_url).toEqual('https://example.com/c1-p1.jpg');
    expect(result1!.pages[1].image_url).toEqual('https://example.com/c1-p2.jpg');

    // Get pages for chapter2 - should only return chapter2's pages
    const input2: GetComicPagesInput = {
      chapter_id: chapter2.id
    };

    const result2 = await getComicPages(input2);

    expect(result2).not.toBeNull();
    expect(result2!.id).toEqual(chapter2.id);
    expect(result2!.title).toEqual('Chapter 2-1');
    expect(result2!.pages).toHaveLength(1);
    expect(result2!.pages[0].image_url).toEqual('https://example.com/c2-p1.jpg');
  });
});
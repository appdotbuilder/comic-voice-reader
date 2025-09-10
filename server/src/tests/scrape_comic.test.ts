import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable, chaptersTable, comicPagesTable } from '../db/schema';
import { type ScrapeComicInput } from '../schema';
import { scrapeComic } from '../handlers/scrape_comic';
import { eq } from 'drizzle-orm';

// Test input for scraping
const testInput: ScrapeComicInput = {
  comic_url: 'https://komiku.org/manga/test-comic'
};

describe('scrapeComic', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should scrape and create a new comic with chapters', async () => {
    const result = await scrapeComic(testInput);

    // Verify comic data
    expect(result.title).toEqual('Test Comic');
    expect(result.slug).toEqual('test-comic');
    expect(result.description).toEqual('A scraped comic from komiku.org');
    expect(result.thumbnail_url).toEqual('https://example.com/thumbnails/test-comic.jpg');
    expect(result.source_url).toEqual(testInput.comic_url);
    expect(result.status).toEqual('ongoing');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify chapters
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].chapter_number).toEqual(1);
    expect(result.chapters[0].title).toEqual('Chapter 1');
    expect(result.chapters[0].page_count).toEqual(2);
    expect(result.chapters[1].chapter_number).toEqual(2);
    expect(result.chapters[1].title).toEqual('Chapter 2');
    expect(result.chapters[1].page_count).toEqual(1);
  });

  it('should save comic data to database', async () => {
    const result = await scrapeComic(testInput);

    // Verify comic in database
    const comics = await db.select()
      .from(comicsTable)
      .where(eq(comicsTable.id, result.id))
      .execute();

    expect(comics).toHaveLength(1);
    expect(comics[0].title).toEqual('Test Comic');
    expect(comics[0].slug).toEqual('test-comic');
    expect(comics[0].source_url).toEqual(testInput.comic_url);

    // Verify chapters in database
    const chapters = await db.select()
      .from(chaptersTable)
      .where(eq(chaptersTable.comic_id, result.id))
      .execute();

    expect(chapters).toHaveLength(2);
    expect(chapters[0].chapter_number).toEqual(1);
    expect(chapters[0].page_count).toEqual(2);
    expect(chapters[1].chapter_number).toEqual(2);
    expect(chapters[1].page_count).toEqual(1);

    // Verify pages in database
    const pages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.chapter_id, chapters[0].id))
      .execute();

    expect(pages).toHaveLength(2);
    
    // Sort pages by page number to ensure consistent ordering
    const sortedPages = pages.sort((a, b) => a.page_number - b.page_number);
    expect(sortedPages[0].page_number).toEqual(1);
    expect(sortedPages[0].image_url).toEqual('https://example.com/pages/test-comic-ch1-p1.jpg');
    expect(sortedPages[1].page_number).toEqual(2);
    expect(sortedPages[1].image_url).toEqual('https://example.com/pages/test-comic-ch1-p2.jpg');
  });

  it('should update existing comic when scraped again', async () => {
    // First scrape
    const firstResult = await scrapeComic(testInput);
    const firstId = firstResult.id;

    // Second scrape of same URL
    const secondResult = await scrapeComic(testInput);

    // Should update existing comic, not create new one
    expect(secondResult.id).toEqual(firstId);
    expect(secondResult.title).toEqual('Test Comic');
    expect(secondResult.updated_at.getTime()).toBeGreaterThanOrEqual(firstResult.updated_at.getTime());

    // Verify only one comic exists in database
    const allComics = await db.select().from(comicsTable).execute();
    expect(allComics).toHaveLength(1);
  });

  it('should handle comic URLs with different formats', async () => {
    const urlVariations = [
      'https://komiku.org/manga/another-comic/',
      'https://komiku.org/manga/yet-another-comic',
      'https://komiku.org/manga/special-chars-comic!'
    ];

    for (const url of urlVariations) {
      const input: ScrapeComicInput = { comic_url: url };
      const result = await scrapeComic(input);

      expect(result.source_url).toEqual(url);
      expect(result.title).toBeDefined();
      expect(result.slug).toBeDefined();
      expect(result.id).toBeDefined();
    }

    // Verify all comics were created
    const allComics = await db.select().from(comicsTable).execute();
    expect(allComics).toHaveLength(urlVariations.length);
  });

  it('should create proper slug from title', async () => {
    const specialTitleInput: ScrapeComicInput = {
      comic_url: 'https://komiku.org/manga/special-title-with-symbols!'
    };

    const result = await scrapeComic(specialTitleInput);

    // Slug should be cleaned and formatted properly
    expect(result.slug).toMatch(/^[a-z0-9-]+$/); // Only lowercase letters, numbers, and hyphens
    expect(result.slug).not.toContain(' '); // No spaces
    expect(result.slug).not.toContain('!'); // No special characters
  });

  it('should handle chapters with different page counts', async () => {
    const result = await scrapeComic(testInput);

    // Sort chapters by chapter number to ensure consistent ordering
    const sortedChapters = result.chapters.sort((a, b) => a.chapter_number - b.chapter_number);

    // Verify chapter 1 has 2 pages, chapter 2 has 1 page
    const chapter1Pages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.chapter_id, sortedChapters[0].id))
      .execute();

    const chapter2Pages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.chapter_id, sortedChapters[1].id))
      .execute();

    expect(chapter1Pages).toHaveLength(2);
    expect(chapter2Pages).toHaveLength(1);

    // Sort pages by page number and verify page data
    const sortedPages = chapter1Pages.sort((a, b) => a.page_number - b.page_number);
    expect(sortedPages[0].page_number).toEqual(1);
    expect(sortedPages[0].source_url).toContain('/chapter-1/page-1');
    expect(sortedPages[1].page_number).toEqual(2);
    expect(sortedPages[1].source_url).toContain('/chapter-1/page-2');
  });

  it('should update existing chapters and pages on re-scrape', async () => {
    // First scrape
    const firstResult = await scrapeComic(testInput);
    const originalChapterId = firstResult.chapters[0].id;

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Second scrape
    const secondResult = await scrapeComic(testInput);

    // Chapter ID should be the same (updated, not recreated)
    expect(secondResult.chapters[0].id).toEqual(originalChapterId);
    expect(secondResult.chapters[0].updated_at.getTime()).toBeGreaterThan(
      firstResult.chapters[0].updated_at.getTime()
    );

    // Verify pages still exist and are updated
    const pages = await db.select()
      .from(comicPagesTable)
      .where(eq(comicPagesTable.chapter_id, originalChapterId))
      .execute();

    expect(pages).toHaveLength(2);
  });
});
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable, chaptersTable } from '../db/schema';
import { type GetComicBySlugInput } from '../schema';
import { getComicBySlug } from '../handlers/get_comic_by_slug';

describe('getComicBySlug', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return comic with chapters when found', async () => {
    // Create test comic
    const comicResult = await db.insert(comicsTable)
      .values({
        title: 'Test Comic',
        slug: 'test-comic',
        description: 'A test comic description',
        thumbnail_url: 'https://example.com/thumbnail.jpg',
        source_url: 'https://komiku.org/test-comic',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const comic = comicResult[0];

    // Create test chapters
    await db.insert(chaptersTable)
      .values([
        {
          comic_id: comic.id,
          chapter_number: 1,
          title: 'Chapter 1',
          slug: 'chapter-1',
          source_url: 'https://komiku.org/test-comic/chapter-1',
          page_count: 20
        },
        {
          comic_id: comic.id,
          chapter_number: 3,
          title: 'Chapter 3',
          slug: 'chapter-3',
          source_url: 'https://komiku.org/test-comic/chapter-3',
          page_count: 25
        },
        {
          comic_id: comic.id,
          chapter_number: 2,
          title: 'Chapter 2',
          slug: 'chapter-2',
          source_url: 'https://komiku.org/test-comic/chapter-2',
          page_count: 18
        }
      ])
      .execute();

    const input: GetComicBySlugInput = {
      slug: 'test-comic'
    };

    const result = await getComicBySlug(input);

    // Verify comic data
    expect(result).toBeDefined();
    expect(result?.id).toEqual(comic.id);
    expect(result?.title).toEqual('Test Comic');
    expect(result?.slug).toEqual('test-comic');
    expect(result?.description).toEqual('A test comic description');
    expect(result?.thumbnail_url).toEqual('https://example.com/thumbnail.jpg');
    expect(result?.source_url).toEqual('https://komiku.org/test-comic');
    expect(result?.status).toEqual('ongoing');
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);

    // Verify chapters are included and ordered correctly
    expect(result?.chapters).toHaveLength(3);
    expect(result?.chapters[0].chapter_number).toEqual(1);
    expect(result?.chapters[0].title).toEqual('Chapter 1');
    expect(result?.chapters[0].page_count).toEqual(20);
    expect(result?.chapters[1].chapter_number).toEqual(2);
    expect(result?.chapters[1].title).toEqual('Chapter 2');
    expect(result?.chapters[1].page_count).toEqual(18);
    expect(result?.chapters[2].chapter_number).toEqual(3);
    expect(result?.chapters[2].title).toEqual('Chapter 3');
    expect(result?.chapters[2].page_count).toEqual(25);

    // Verify all chapters have proper timestamps
    result?.chapters.forEach(chapter => {
      expect(chapter.created_at).toBeInstanceOf(Date);
      expect(chapter.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return null when comic not found', async () => {
    const input: GetComicBySlugInput = {
      slug: 'non-existent-comic'
    };

    const result = await getComicBySlug(input);

    expect(result).toBeNull();
  });

  it('should return comic with empty chapters array when no chapters exist', async () => {
    // Create test comic without chapters
    const comicResult = await db.insert(comicsTable)
      .values({
        title: 'Comic Without Chapters',
        slug: 'comic-without-chapters',
        description: 'A comic with no chapters yet',
        thumbnail_url: null,
        source_url: 'https://komiku.org/comic-without-chapters',
        status: 'ongoing'
      })
      .returning()
      .execute();

    const comic = comicResult[0];

    const input: GetComicBySlugInput = {
      slug: 'comic-without-chapters'
    };

    const result = await getComicBySlug(input);

    expect(result).toBeDefined();
    expect(result?.id).toEqual(comic.id);
    expect(result?.title).toEqual('Comic Without Chapters');
    expect(result?.slug).toEqual('comic-without-chapters');
    expect(result?.chapters).toHaveLength(0);
  });

  it('should handle comics with nullable fields', async () => {
    // Create test comic with nullable fields set to null
    const comicResult = await db.insert(comicsTable)
      .values({
        title: 'Minimal Comic',
        slug: 'minimal-comic',
        description: null,
        thumbnail_url: null,
        source_url: 'https://komiku.org/minimal-comic',
        status: 'completed'
      })
      .returning()
      .execute();

    const comic = comicResult[0];

    const input: GetComicBySlugInput = {
      slug: 'minimal-comic'
    };

    const result = await getComicBySlug(input);

    expect(result).toBeDefined();
    expect(result?.id).toEqual(comic.id);
    expect(result?.title).toEqual('Minimal Comic');
    expect(result?.slug).toEqual('minimal-comic');
    expect(result?.description).toBeNull();
    expect(result?.thumbnail_url).toBeNull();
    expect(result?.source_url).toEqual('https://komiku.org/minimal-comic');
    expect(result?.status).toEqual('completed');
    expect(result?.chapters).toHaveLength(0);
  });

  it('should be case sensitive for slug matching', async () => {
    // Create test comic
    await db.insert(comicsTable)
      .values({
        title: 'Case Sensitive Comic',
        slug: 'Case-Sensitive-Comic',
        description: 'Testing case sensitivity',
        source_url: 'https://komiku.org/case-sensitive-comic',
        status: 'ongoing'
      })
      .execute();

    // Try with different case
    const input: GetComicBySlugInput = {
      slug: 'case-sensitive-comic'
    };

    const result = await getComicBySlug(input);

    expect(result).toBeNull();
  });

  it('should handle chapters with different statuses', async () => {
    // Create test comic with hiatus status
    const comicResult = await db.insert(comicsTable)
      .values({
        title: 'Hiatus Comic',
        slug: 'hiatus-comic',
        description: 'A comic on hiatus',
        source_url: 'https://komiku.org/hiatus-comic',
        status: 'hiatus'
      })
      .returning()
      .execute();

    const comic = comicResult[0];

    // Create chapter with specific data
    await db.insert(chaptersTable)
      .values({
        comic_id: comic.id,
        chapter_number: 1,
        title: 'First Chapter',
        slug: 'first-chapter',
        source_url: 'https://komiku.org/hiatus-comic/first-chapter',
        page_count: 30
      })
      .execute();

    const input: GetComicBySlugInput = {
      slug: 'hiatus-comic'
    };

    const result = await getComicBySlug(input);

    expect(result).toBeDefined();
    expect(result?.status).toEqual('hiatus');
    expect(result?.chapters).toHaveLength(1);
    expect(result?.chapters[0].title).toEqual('First Chapter');
    expect(result?.chapters[0].page_count).toEqual(30);
  });
});
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { comicsTable } from '../db/schema';
import { type SearchComicsInput } from '../schema';
import { searchComics } from '../handlers/search_comics';

// Test input with all fields (including defaults)
const defaultInput: SearchComicsInput = {
  query: 'naruto',
  limit: 20,
  offset: 0
};

describe('searchComics', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty results when no comics match', async () => {
    const result = await searchComics(defaultInput);

    expect(result.comics).toHaveLength(0);
    expect(result.total_count).toEqual(0);
    expect(result.has_more).toEqual(false);
  });

  it('should search comics by title', async () => {
    // Create test comics
    await db.insert(comicsTable).values([
      {
        title: 'Naruto Shippuden',
        slug: 'naruto-shippuden',
        description: 'Epic ninja adventure',
        source_url: 'https://komiku.org/manga/naruto-shippuden',
        status: 'completed'
      },
      {
        title: 'One Piece',
        slug: 'one-piece',
        description: 'Pirate adventure',
        source_url: 'https://komiku.org/manga/one-piece',
        status: 'ongoing'
      },
      {
        title: 'Naruto Classic',
        slug: 'naruto-classic',
        description: 'Original ninja story',
        source_url: 'https://komiku.org/manga/naruto-classic',
        status: 'completed'
      }
    ]).execute();

    const result = await searchComics(defaultInput);

    expect(result.comics).toHaveLength(2);
    expect(result.total_count).toEqual(2);
    expect(result.has_more).toEqual(false);

    // Check that results are ordered by title
    expect(result.comics[0].title).toEqual('Naruto Classic');
    expect(result.comics[1].title).toEqual('Naruto Shippuden');

    // Verify all fields are present
    result.comics.forEach(comic => {
      expect(comic.id).toBeDefined();
      expect(comic.title).toBeDefined();
      expect(comic.slug).toBeDefined();
      expect(comic.source_url).toBeDefined();
      expect(comic.status).toBeDefined();
      expect(comic.created_at).toBeInstanceOf(Date);
      expect(comic.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should search comics by description', async () => {
    // Create test comics
    await db.insert(comicsTable).values([
      {
        title: 'Attack on Titan',
        slug: 'attack-on-titan',
        description: 'Humanity fights against giant naruto-like creatures',
        source_url: 'https://komiku.org/manga/attack-on-titan',
        status: 'completed'
      },
      {
        title: 'Bleach',
        slug: 'bleach',
        description: 'Soul reaper adventure',
        source_url: 'https://komiku.org/manga/bleach',
        status: 'completed'
      }
    ]).execute();

    const result = await searchComics(defaultInput);

    expect(result.comics).toHaveLength(1);
    expect(result.total_count).toEqual(1);
    expect(result.comics[0].title).toEqual('Attack on Titan');
  });

  it('should handle case-insensitive search', async () => {
    // Create test comic
    await db.insert(comicsTable).values({
      title: 'Dragon Ball Z',
      slug: 'dragon-ball-z',
      description: 'Saiyan warriors story',
      source_url: 'https://komiku.org/manga/dragon-ball-z',
      status: 'completed'
    }).execute();

    const upperCaseInput: SearchComicsInput = {
      query: 'DRAGON',
      limit: 20,
      offset: 0
    };

    const result = await searchComics(upperCaseInput);

    expect(result.comics).toHaveLength(1);
    expect(result.comics[0].title).toEqual('Dragon Ball Z');
  });

  it('should apply limit parameter correctly', async () => {
    // Create multiple test comics
    const comics = Array.from({ length: 5 }, (_, i) => ({
      title: `Naruto Volume ${i + 1}`,
      slug: `naruto-volume-${i + 1}`,
      description: 'Ninja adventure',
      source_url: `https://komiku.org/manga/naruto-volume-${i + 1}`,
      status: 'ongoing' as const
    }));

    await db.insert(comicsTable).values(comics).execute();

    const limitedInput: SearchComicsInput = {
      query: 'naruto',
      limit: 3,
      offset: 0
    };

    const result = await searchComics(limitedInput);

    expect(result.comics).toHaveLength(3);
    expect(result.total_count).toEqual(5);
    expect(result.has_more).toEqual(true);
  });

  it('should apply offset parameter correctly', async () => {
    // Create test comics
    const comics = Array.from({ length: 5 }, (_, i) => ({
      title: `Naruto Volume ${i + 1}`,
      slug: `naruto-volume-${i + 1}`,
      description: 'Ninja adventure',
      source_url: `https://komiku.org/manga/naruto-volume-${i + 1}`,
      status: 'ongoing' as const
    }));

    await db.insert(comicsTable).values(comics).execute();

    const offsetInput: SearchComicsInput = {
      query: 'naruto',
      limit: 2,
      offset: 2
    };

    const result = await searchComics(offsetInput);

    expect(result.comics).toHaveLength(2);
    expect(result.total_count).toEqual(5);
    expect(result.has_more).toEqual(true);

    // Verify we got the correct offset results (3rd and 4th items alphabetically)
    expect(result.comics[0].title).toEqual('Naruto Volume 3');
    expect(result.comics[1].title).toEqual('Naruto Volume 4');
  });

  it('should handle pagination correctly at the end', async () => {
    // Create test comics
    const comics = Array.from({ length: 3 }, (_, i) => ({
      title: `Naruto Volume ${i + 1}`,
      slug: `naruto-volume-${i + 1}`,
      description: 'Ninja adventure',
      source_url: `https://komiku.org/manga/naruto-volume-${i + 1}`,
      status: 'ongoing' as const
    }));

    await db.insert(comicsTable).values(comics).execute();

    const lastPageInput: SearchComicsInput = {
      query: 'naruto',
      limit: 10,
      offset: 0
    };

    const result = await searchComics(lastPageInput);

    expect(result.comics).toHaveLength(3);
    expect(result.total_count).toEqual(3);
    expect(result.has_more).toEqual(false);
  });

  it('should handle comics with null descriptions', async () => {
    // Create comic with null description
    await db.insert(comicsTable).values({
      title: 'Naruto Blank',
      slug: 'naruto-blank',
      description: null,
      source_url: 'https://komiku.org/manga/naruto-blank',
      status: 'ongoing'
    }).execute();

    const result = await searchComics(defaultInput);

    expect(result.comics).toHaveLength(1);
    expect(result.comics[0].title).toEqual('Naruto Blank');
    expect(result.comics[0].description).toBeNull();
  });

  it('should search with partial matches', async () => {
    // Create test comic
    await db.insert(comicsTable).values({
      title: 'Super Naruto Adventures',
      slug: 'super-naruto-adventures',
      description: 'Extended ninja story',
      source_url: 'https://komiku.org/manga/super-naruto-adventures',
      status: 'ongoing'
    }).execute();

    const partialInput: SearchComicsInput = {
      query: 'nar',
      limit: 20,
      offset: 0
    };

    const result = await searchComics(partialInput);

    expect(result.comics).toHaveLength(1);
    expect(result.comics[0].title).toEqual('Super Naruto Adventures');
  });

  it('should return results ordered by title alphabetically', async () => {
    // Create test comics in random order
    await db.insert(comicsTable).values([
      {
        title: 'Zebra Comic',
        slug: 'zebra-comic',
        description: 'Test description',
        source_url: 'https://komiku.org/manga/zebra-comic',
        status: 'ongoing'
      },
      {
        title: 'Alpha Comic',
        slug: 'alpha-comic',
        description: 'Test description',
        source_url: 'https://komiku.org/manga/alpha-comic',
        status: 'ongoing'
      },
      {
        title: 'Beta Comic',
        slug: 'beta-comic',
        description: 'Test description',
        source_url: 'https://komiku.org/manga/beta-comic',
        status: 'ongoing'
      }
    ]).execute();

    const testInput: SearchComicsInput = {
      query: 'comic',
      limit: 20,
      offset: 0
    };

    const result = await searchComics(testInput);

    expect(result.comics).toHaveLength(3);
    expect(result.comics[0].title).toEqual('Alpha Comic');
    expect(result.comics[1].title).toEqual('Beta Comic');
    expect(result.comics[2].title).toEqual('Zebra Comic');
  });
});
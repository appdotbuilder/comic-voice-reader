import { db } from '../db';
import { comicsTable, chaptersTable, comicPagesTable } from '../db/schema';
import { type ScrapeComicInput, type ComicWithChapters } from '../schema';
import { eq } from 'drizzle-orm';

// Helper function to create slug from title
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

// Mock scraping function - in real implementation this would parse HTML
async function scrapeComicData(url: string): Promise<{
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: 'ongoing' | 'completed' | 'hiatus';
  chapters: Array<{
    chapter_number: number;
    title: string;
    source_url: string;
    pages: Array<{
      page_number: number;
      image_url: string;
      source_url: string;
    }>;
  }>;
}> {
  // This is a mock implementation - real scraping would use libraries like cheerio
  // to parse HTML from komiku.org and extract comic data
  
  // Extract comic title from URL for demonstration
  const urlParts = url.split('/');
  const comicSlug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'unknown-comic';
  
  return {
    title: comicSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: 'A scraped comic from komiku.org',
    thumbnail_url: `https://example.com/thumbnails/${comicSlug}.jpg`,
    status: 'ongoing',
    chapters: [
      {
        chapter_number: 1,
        title: 'Chapter 1',
        source_url: `${url}/chapter-1`,
        pages: [
          {
            page_number: 1,
            image_url: `https://example.com/pages/${comicSlug}-ch1-p1.jpg`,
            source_url: `${url}/chapter-1/page-1`
          },
          {
            page_number: 2,
            image_url: `https://example.com/pages/${comicSlug}-ch1-p2.jpg`,
            source_url: `${url}/chapter-1/page-2`
          }
        ]
      },
      {
        chapter_number: 2,
        title: 'Chapter 2',
        source_url: `${url}/chapter-2`,
        pages: [
          {
            page_number: 1,
            image_url: `https://example.com/pages/${comicSlug}-ch2-p1.jpg`,
            source_url: `${url}/chapter-2/page-1`
          }
        ]
      }
    ]
  };
}

export async function scrapeComic(input: ScrapeComicInput): Promise<ComicWithChapters> {
  try {
    // Scrape comic data from the provided URL
    const scrapedData = await scrapeComicData(input.comic_url);
    
    const slug = createSlug(scrapedData.title);
    
    // Check if comic already exists
    const existingComic = await db.select()
      .from(comicsTable)
      .where(eq(comicsTable.slug, slug))
      .execute();
    
    let comic;
    
    if (existingComic.length > 0) {
      // Update existing comic
      const updateResult = await db.update(comicsTable)
        .set({
          title: scrapedData.title,
          description: scrapedData.description,
          thumbnail_url: scrapedData.thumbnail_url,
          status: scrapedData.status,
          updated_at: new Date()
        })
        .where(eq(comicsTable.id, existingComic[0].id))
        .returning()
        .execute();
      
      comic = updateResult[0];
    } else {
      // Create new comic
      const insertResult = await db.insert(comicsTable)
        .values({
          title: scrapedData.title,
          slug: slug,
          description: scrapedData.description,
          thumbnail_url: scrapedData.thumbnail_url,
          source_url: input.comic_url,
          status: scrapedData.status
        })
        .returning()
        .execute();
      
      comic = insertResult[0];
    }
    
    // Process chapters
    const chapters = [];
    
    for (const chapterData of scrapedData.chapters) {
      const chapterSlug = createSlug(`${comic.title}-chapter-${chapterData.chapter_number}`);
      
      // Check if chapter already exists
      const existingChapter = await db.select()
        .from(chaptersTable)
        .where(eq(chaptersTable.comic_id, comic.id))
        .execute();
      
      const existingChapterMatch = existingChapter.find(ch => ch.chapter_number === chapterData.chapter_number);
      
      let chapter;
      
      if (existingChapterMatch) {
        // Update existing chapter
        const updateResult = await db.update(chaptersTable)
          .set({
            title: chapterData.title,
            slug: chapterSlug,
            source_url: chapterData.source_url,
            page_count: chapterData.pages.length,
            updated_at: new Date()
          })
          .where(eq(chaptersTable.id, existingChapterMatch.id))
          .returning()
          .execute();
        
        chapter = updateResult[0];
      } else {
        // Create new chapter
        const insertResult = await db.insert(chaptersTable)
          .values({
            comic_id: comic.id,
            chapter_number: chapterData.chapter_number,
            title: chapterData.title,
            slug: chapterSlug,
            source_url: chapterData.source_url,
            page_count: chapterData.pages.length
          })
          .returning()
          .execute();
        
        chapter = insertResult[0];
      }
      
      // Process pages for this chapter
      for (const pageData of chapterData.pages) {
        // Check if page already exists
        const existingPage = await db.select()
          .from(comicPagesTable)
          .where(eq(comicPagesTable.chapter_id, chapter.id))
          .execute();
        
        const existingPageMatch = existingPage.find(p => p.page_number === pageData.page_number);
        
        if (!existingPageMatch) {
          // Create new page
          await db.insert(comicPagesTable)
            .values({
              chapter_id: chapter.id,
              page_number: pageData.page_number,
              image_url: pageData.image_url,
              source_url: pageData.source_url
            })
            .execute();
        } else {
          // Update existing page
          await db.update(comicPagesTable)
            .set({
              image_url: pageData.image_url,
              source_url: pageData.source_url,
              updated_at: new Date()
            })
            .where(eq(comicPagesTable.id, existingPageMatch.id))
            .execute();
        }
      }
      
      chapters.push(chapter);
    }
    
    return {
      ...comic,
      chapters: chapters
    };
    
  } catch (error) {
    console.error('Comic scraping failed:', error);
    throw error;
  }
}
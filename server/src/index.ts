import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schema types
import {
  searchComicsInputSchema,
  getComicBySlugInputSchema,
  getChaptersInputSchema,
  getComicPagesInputSchema,
  updateOcrTextInputSchema,
  updateReadingProgressInputSchema,
  getReadingProgressInputSchema,
  scrapeComicInputSchema
} from './schema';

// Import handlers
import { searchComics } from './handlers/search_comics';
import { getComicBySlug } from './handlers/get_comic_by_slug';
import { getChapters } from './handlers/get_chapters';
import { getComicPages } from './handlers/get_comic_pages';
import { updateOcrText } from './handlers/update_ocr_text';
import { updateReadingProgress } from './handlers/update_reading_progress';
import { getReadingProgress } from './handlers/get_reading_progress';
import { scrapeComic } from './handlers/scrape_comic';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Comic search and browsing
  searchComics: publicProcedure
    .input(searchComicsInputSchema)
    .query(({ input }) => searchComics(input)),

  getComicBySlug: publicProcedure
    .input(getComicBySlugInputSchema)
    .query(({ input }) => getComicBySlug(input)),

  getChapters: publicProcedure
    .input(getChaptersInputSchema)
    .query(({ input }) => getChapters(input)),

  getComicPages: publicProcedure
    .input(getComicPagesInputSchema)
    .query(({ input }) => getComicPages(input)),

  // OCR and TTS support
  updateOcrText: publicProcedure
    .input(updateOcrTextInputSchema)
    .mutation(({ input }) => updateOcrText(input)),

  // Reading progress tracking
  updateReadingProgress: publicProcedure
    .input(updateReadingProgressInputSchema)
    .mutation(({ input }) => updateReadingProgress(input)),

  getReadingProgress: publicProcedure
    .input(getReadingProgressInputSchema)
    .query(({ input }) => getReadingProgress(input)),

  // Web scraping functionality
  scrapeComic: publicProcedure
    .input(scrapeComicInputSchema)
    .mutation(({ input }) => scrapeComic(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Comic Voice Reader TRPC server listening at port: ${port}`);
}

start();
import { db } from '../db';
import { comicPagesTable } from '../db/schema';
import { type UpdateOcrTextInput, type ComicPage } from '../schema';
import { eq } from 'drizzle-orm';

export const updateOcrText = async (input: UpdateOcrTextInput): Promise<ComicPage> => {
  try {
    // Update the OCR text and processed timestamp for the specified page
    const result = await db.update(comicPagesTable)
      .set({
        ocr_text: input.ocr_text,
        ocr_processed_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(comicPagesTable.id, input.page_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Comic page with ID ${input.page_id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('OCR text update failed:', error);
    throw error;
  }
};
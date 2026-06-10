import express from 'express';
import fetch from 'node-fetch';
import supabase from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, requireRole('admin'));

const GUTENDEX_URL = 'https://gutendex.com/books/';

// Helper: split Gutenberg plain text into chapters by chapter headings
function splitIntoChapters(text) {
  const chapterRegex = /\bCHAPTER\s+[IVXLCDM\d]+[\.\s]/gi;
  const splits = text.split(chapterRegex);
  const headers = [...text.matchAll(chapterRegex)].map((m) => m[0].trim());

  if (splits.length <= 1) {
    // No chapters found — split by length (every ~3000 words)
    const words = text.split(' ');
    const chunks = [];
    const chunkSize = 3000;
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push({ title: `Part ${Math.floor(i / chunkSize) + 1}`, content: words.slice(i, i + chunkSize).join(' ') });
    }
    return chunks.slice(0, 30); // max 30 parts
  }

  return splits.slice(1).map((content, i) => ({
    title: headers[i] || `Chapter ${i + 1}`,
    content: content.trim().slice(0, 50000), // cap per chapter
  }));
}

// POST /api/seed/import — import N books from Gutendex
router.post('/import', async (req, res) => {
  const { page = 1, topic } = req.body;
  let url = `${GUTENDEX_URL}?page=${page}&languages=en`;
  if (topic) url += `&topic=${encodeURIComponent(topic)}`;

  try {
    const gutRes = await fetch(url);
    const { results } = await gutRes.json();

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const book of results.slice(0, 10)) {
      // Skip if already exists
      const { data: exists } = await supabase
        .from('novels')
        .select('id')
        .eq('title', book.title)
        .eq('source', 'api')
        .single();

      if (exists) { skipped++; continue; }

      const authorName = book.authors?.[0]?.name || 'Unknown Author';
      const subjects = book.subjects || [];

      // Find or generate a cover from Gutenberg
      const cover_image = book.formats?.['image/jpeg'] || null;

      // Extract description from subjects
      const description = subjects.length > 0
        ? `A classic work by ${authorName}. Subjects: ${subjects.slice(0, 3).join(', ')}.`
        : `A classic work by ${authorName}.`;

      // Insert novel
      const { data: novel, error: novelError } = await supabase
        .from('novels')
        .insert({
          title: book.title,
          description,
          cover_image,
          author_id: null,
          source: 'api',
          status: 'approved',
          gutenberg_id: book.id,
          gutenberg_author: authorName,
        })
        .select()
        .single();

      if (novelError) { errors.push(`${book.title}: ${novelError.message}`); continue; }

      // Try to fetch full text
      const textUrl = book.formats?.['text/plain; charset=utf-8']
        || book.formats?.['text/plain; charset=us-ascii']
        || book.formats?.['text/plain'];

      if (textUrl) {
        try {
          const textRes = await fetch(textUrl);
          const rawText = await textRes.text();

          // Remove Project Gutenberg header/footer boilerplate
          const startIdx = rawText.search(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG/i);
          const endIdx = rawText.search(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG/i);
          const cleanText = startIdx > -1
            ? rawText.slice(startIdx + 100, endIdx > -1 ? endIdx : undefined)
            : rawText;

          const chapters = splitIntoChapters(cleanText);

          const chapterRows = chapters.map((ch, i) => ({
            novel_id: novel.id,
            title: ch.title,
            content: ch.content,
            chapter_number: i + 1,
          }));

          await supabase.from('chapters').insert(chapterRows);
        } catch (textErr) {
          // If text fetch fails, add a placeholder chapter
          await supabase.from('chapters').insert({
            novel_id: novel.id,
            title: 'Chapter 1',
            content: 'Full text not available for this edition. Visit Project Gutenberg for the complete text.',
            chapter_number: 1,
          });
        }
      }

      imported++;
    }

    res.json({ message: `Import complete`, imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/seed/preview — preview books without importing
router.get('/preview', async (req, res) => {
  const { page = 1 } = req.query;
  try {
    const gutRes = await fetch(`${GUTENDEX_URL}?page=${page}&languages=en`);
    const data = await gutRes.json();

    const books = data.results.map((b) => ({
      gutenberg_id: b.id,
      title: b.title,
      author: b.authors?.[0]?.name || 'Unknown',
      cover: b.formats?.['image/jpeg'] || null,
      subjects: b.subjects?.slice(0, 3),
      download_count: b.download_count,
    }));

    res.json({ books, next: data.next, count: data.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

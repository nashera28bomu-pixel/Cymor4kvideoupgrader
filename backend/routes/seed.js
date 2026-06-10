import express from 'express';
import fetch from 'node-fetch';
import supabase from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, requireRole('admin'));

const GUTENDEX_URL = 'https://gutendex.com/books/';

// ─────────────────────────────────────────────
// CLEAN GUTENBERG TEXT (IMPORTANT FIX)
// ─────────────────────────────────────────────
function cleanText(text) {
  const start = text.search(/\*\*\* START OF/);
  const end = text.search(/\*\*\* END OF/);

  let cleaned = start > -1
    ? text.slice(start, end > -1 ? end : undefined)
    : text;

  return cleaned
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────
// SMART CHAPTER SPLITTER
// ─────────────────────────────────────────────
function splitIntoChapters(text) {
  const chapterRegex = /(chapter\s+(?:[ivx0-9]+|one|two|three|four|five|six|seven|eight|nine|ten))/gi;

  const matches = [...text.matchAll(chapterRegex)];

  // CASE 1: Real chapters found
  if (matches.length >= 3) {
    const parts = text.split(chapterRegex);

    return parts
      .filter(p => p.trim().length > 200)
      .map((content, i) => ({
        title: `Chapter ${i + 1}`,
        content: content.trim()
      }));
  }

  // CASE 2: fallback chunking
  return chunkText(text, 3500);
}

// ─────────────────────────────────────────────
// SAFE FALLBACK CHUNKER
// ─────────────────────────────────────────────
function chunkText(text, size = 3500) {
  const words = text.split(' ');
  const chunks = [];

  for (let i = 0; i < words.length; i += size) {
    const chunk = words.slice(i, i + size).join(' ');

    if (chunk.length > 800) {
      chunks.push({
        title: `Chapter ${chunks.length + 1}`,
        content: chunk
      });
    }
  }

  return chunks;
}

// ─────────────────────────────────────────────
// IMPORT BOOKS
// ─────────────────────────────────────────────
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

      // Skip duplicates
      const { data: exists } = await supabase
        .from('novels')
        .select('id')
        .eq('title', book.title)
        .eq('source', 'api')
        .maybeSingle();

      if (exists) {
        skipped++;
        continue;
      }

      const author = book.authors?.[0]?.name || 'Unknown Author';
      const cover = book.formats?.['image/jpeg'] || null;

      const description =
        book.subjects?.length > 0
          ? `A classic work by ${author}. Subjects: ${book.subjects.slice(0, 3).join(', ')}.`
          : `A classic work by ${author}.`;

      // Insert novel
      const { data: novel, error } = await supabase
        .from('novels')
        .insert({
          title: book.title,
          description,
          cover_image: cover,
          author_id: null,
          source: 'api',
          status: 'approved',
          gutenberg_id: book.id,
          gutenberg_author: author,
        })
        .select()
        .single();

      if (error) {
        errors.push(`${book.title}: ${error.message}`);
        continue;
      }

      // Fetch full text
      const textUrl =
        book.formats?.['text/plain; charset=utf-8'] ||
        book.formats?.['text/plain; charset=us-ascii'] ||
        book.formats?.['text/plain'];

      if (!textUrl) continue;

      try {
        const textRes = await fetch(textUrl);
        const rawText = await textRes.text();

        const clean = cleanText(rawText);
        const chapters = splitIntoChapters(clean);

        const rows = chapters.map((ch, i) => ({
          novel_id: novel.id,
          title: ch.title,
          content: ch.content,
          chapter_number: i + 1,
        }));

        await supabase.from('chapters').insert(rows);

      } catch (err) {
        await supabase.from('chapters').insert({
          novel_id: novel.id,
          title: 'Chapter 1',
          content: 'Text unavailable for this book.',
          chapter_number: 1,
        });
      }

      imported++;
    }

    res.json({
      message: 'Import complete',
      imported,
      skipped,
      errors
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// PREVIEW ROUTE
// ─────────────────────────────────────────────
router.get('/preview', async (req, res) => {
  const { page = 1 } = req.query;

  try {
    const resGut = await fetch(`${GUTENDEX_URL}?page=${page}&languages=en`);
    const data = await resGut.json();

    const books = data.results.map(b => ({
      id: b.id,
      title: b.title,
      author: b.authors?.[0]?.name || 'Unknown',
      cover: b.formats?.['image/jpeg'] || null,
      subjects: b.subjects?.slice(0, 3),
      downloads: b.download_count
    }));

    res.json({ books, next: data.next });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

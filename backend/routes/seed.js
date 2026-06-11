import express from 'express';
import fetch from 'node-fetch';
import supabase from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const GUTENDEX_URL = 'https://gutendex.com/books/';

// ── FIX 1: Better chapter splitter — handles real Gutenberg formatting
function splitIntoChapters(text) {
  // Remove excessive whitespace but preserve paragraph breaks
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Try multiple chapter heading patterns
  const patterns = [
    /\n\s*(CHAPTER\s+[IVXLCDM\d]+[.:)—\s][^\n]*)\n/gi,
    /\n\s*(Chapter\s+[IVXLCDM\d]+[.:)—\s][^\n]*)\n/g,
    /\n\s*(PART\s+[IVXLCDM\d]+[.:)—\s][^\n]*)\n/gi,
    /\n\s*(BOOK\s+[IVXLCDM\d]+[.:)—\s][^\n]*)\n/gi,
  ];

  let bestSplit = null;
  let bestHeaders = [];

  for (const pattern of patterns) {
    const headers = [...normalized.matchAll(pattern)].map(m => m[1].trim());
    if (headers.length >= 2) {
      bestHeaders = headers;
      bestSplit = normalized.split(pattern);
      break;
    }
  }

  // No chapter markers — split by ~4000 words (longer chunks = real reading)
  if (!bestSplit || bestSplit.length <= 2) {
    const paragraphs = normalized.split(/\n{2,}/).filter(p => p.trim().length > 30);
    const chunks = [];
    const wordsPerChunk = 4000;
    let current = [];
    let wordCount = 0;
    let chunkNum = 1;

    for (const para of paragraphs) {
      const words = para.split(/\s+/).length;
      current.push(para);
      wordCount += words;
      if (wordCount >= wordsPerChunk) {
        chunks.push({ title: `Part ${chunkNum}`, content: current.join('\n\n') });
        current = []; wordCount = 0; chunkNum++;
      }
    }
    if (current.length) chunks.push({ title: `Part ${chunkNum}`, content: current.join('\n\n') });
    return chunks.slice(0, 40);
  }

  // Filter out the header matches from splits (odd indices are header captures)
  const contentParts = [];
  for (let i = 0; i < bestSplit.length; i++) {
    if (i === 0) continue; // before first chapter — usually preamble
    // odd index = captured header group, even = content after it
    if (i % 2 === 1) continue; // skip the captured header text
    const headerIdx = Math.floor((i - 1) / 2);
    const header = bestHeaders[headerIdx] || `Chapter ${headerIdx + 1}`;
    const content = bestSplit[i]?.trim() || '';
    if (content.length > 50) {
      contentParts.push({ title: header, content });
    }
  }

  // Fallback if pattern split produced nothing useful
  if (contentParts.length < 2) {
    const simpleHeaders = [...normalized.matchAll(/\n(CHAPTER [^\n]+)\n/gi)].map(m => m[1].trim());
    const simpleParts = normalized.split(/\nCHAPTER [^\n]+\n/gi).slice(1);
    if (simpleParts.length >= 2) {
      return simpleParts.map((content, i) => ({
        title: simpleHeaders[i] || `Chapter ${i + 1}`,
        content: content.trim(),
      })).filter(c => c.content.length > 50);
    }
  }

  return contentParts.length ? contentParts : [{ title: 'Full Text', content: normalized }];
}

// ── POST /api/seed/import — Gutenberg import
router.post('/import', async (req, res) => {
  const { page = 1, topic } = req.body;
  let url = `${GUTENDEX_URL}?page=${page}&languages=en`;
  if (topic) url += `&topic=${encodeURIComponent(topic)}`;

  try {
    const gutRes = await fetch(url);
    const { results } = await gutRes.json();

    let imported = 0, skipped = 0;
    const errors = [];

    for (const book of results.slice(0, 10)) {
      const { data: exists } = await supabase
        .from('novels').select('id').eq('title', book.title).eq('source', 'api').single();
      if (exists) { skipped++; continue; }

      const authorName = book.authors?.[0]?.name || 'Unknown Author';
      const subjects = book.subjects || [];
      const cover_image = book.formats?.['image/jpeg'] || null;
      const description = subjects.length > 0
        ? `A classic work by ${authorName}. Subjects: ${subjects.slice(0, 3).join(', ')}.`
        : `A classic work by ${authorName}.`;

      const { data: novel, error: novelError } = await supabase
        .from('novels')
        .insert({ title: book.title, description, cover_image, author_id: null, source: 'api', status: 'approved', gutenberg_id: book.id, gutenberg_author: authorName })
        .select().single();

      if (novelError) { errors.push(`${book.title}: ${novelError.message}`); continue; }

      const textUrl = book.formats?.['text/plain; charset=utf-8']
        || book.formats?.['text/plain; charset=us-ascii']
        || book.formats?.['text/plain'];

      if (textUrl) {
        try {
          const textRes = await fetch(textUrl);
          const rawText = await textRes.text();

          const startIdx = rawText.search(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG/i);
          const endIdx   = rawText.search(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG/i);
          const cleanText = startIdx > -1
            ? rawText.slice(startIdx + 200, endIdx > -1 ? endIdx : undefined)
            : rawText;

          const chapters = splitIntoChapters(cleanText);
          const chapterRows = chapters.map((ch, i) => ({
            novel_id: novel.id,
            title: ch.title,
            content: ch.content,
            chapter_number: i + 1,
          }));

          // Insert in batches of 10 to avoid payload limits
          for (let i = 0; i < chapterRows.length; i += 10) {
            await supabase.from('chapters').insert(chapterRows.slice(i, i + 10));
          }
        } catch {
          await supabase.from('chapters').insert({
            novel_id: novel.id, title: 'Full Text',
            content: 'Text could not be fetched. Visit gutenberg.org for full text.',
            chapter_number: 1,
          });
        }
      }
      imported++;
    }

    res.json({ message: 'Import complete', imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/seed/openlibrary — FIX 3: Open Library as extra source
router.post('/openlibrary', async (req, res) => {
  const { subject = 'romance', limit = 8 } = req.body;
  const url = `https://openlibrary.org/subjects/${subject}.json?limit=${limit}&offset=0`;

  try {
    const olRes = await fetch(url);
    const data  = await olRes.json();
    const works = data.works || [];

    let imported = 0, skipped = 0;
    const errors = [];

    for (const work of works) {
      const title      = work.title;
      const authorName = work.authors?.[0]?.name || 'Unknown Author';
      const coverId    = work.cover_id || work.cover_edition_key;
      const cover_image = coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
        : null;
      const description = work.description
        ? (typeof work.description === 'string' ? work.description : work.description?.value || '')
        : `A ${subject} story by ${authorName}.`;

      const { data: exists } = await supabase
        .from('novels').select('id').eq('title', title).eq('source', 'api').single();
      if (exists) { skipped++; continue; }

      // Fetch full work details to get subjects / description
      let fullDesc = description.slice(0, 500);
      try {
        const workKey = work.key; // e.g. /works/OL123W
        const detailRes = await fetch(`https://openlibrary.org${workKey}.json`);
        const detail    = await detailRes.json();
        if (detail.description) {
          fullDesc = typeof detail.description === 'string'
            ? detail.description.slice(0, 500)
            : (detail.description?.value || fullDesc).slice(0, 500);
        }
      } catch {}

      const { data: novel, error: novelError } = await supabase
        .from('novels')
        .insert({
          title, description: fullDesc, cover_image,
          author_id: null, source: 'api', status: 'approved',
          gutenberg_author: authorName,
        })
        .select().single();

      if (novelError) { errors.push(`${title}: ${novelError.message}`); continue; }

      // Open Library doesn't serve raw text, so add a rich intro chapter
      await supabase.from('chapters').insert({
        novel_id: novel.id,
        title: 'About This Book',
        chapter_number: 1,
        content: `${fullDesc}\n\nThis book is available in full at Open Library: https://openlibrary.org${work.key}\n\nYou can read it free online or borrow a digital copy through the Open Library lending program at archive.org.`,
      });

      imported++;
    }

    res.json({ message: 'Open Library import complete', imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/seed/preview
router.get('/preview', async (req, res) => {
  const { page = 1 } = req.query;
  try {
    const gutRes = await fetch(`${GUTENDEX_URL}?page=${page}&languages=en`);
    const data   = await gutRes.json();
    const books  = data.results.map(b => ({
      gutenberg_id: b.id, title: b.title,
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

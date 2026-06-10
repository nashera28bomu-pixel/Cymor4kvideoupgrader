import express from 'express';
import supabase from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/chapters/:id — read a single chapter (public if novel approved)
router.get('/:id', async (req, res) => {
  try {
    const { data: chapter, error } = await supabase
      .from('chapters')
      .select(`
        *,
        novel:novels(id, title, status, author:users(username))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !chapter) return res.status(404).json({ error: 'Chapter not found' });
    if (chapter.novel.status !== 'approved') return res.status(403).json({ error: 'Novel not available' });

    // Fetch prev/next chapter for navigation
    const { data: siblings } = await supabase
      .from('chapters')
      .select('id, title, chapter_number')
      .eq('novel_id', chapter.novel_id)
      .order('chapter_number');

    const idx = siblings?.findIndex((c) => c.id === chapter.id) ?? -1;
    chapter.prev_chapter = idx > 0 ? siblings[idx - 1] : null;
    chapter.next_chapter = idx < siblings.length - 1 ? siblings[idx + 1] : null;

    res.json({ chapter });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chapters — author adds chapter to their novel
router.post('/', authenticate, requireRole('author', 'admin'), async (req, res) => {
  const { novel_id, title, content, chapter_number } = req.body;

  if (!novel_id || !title || !content) {
    return res.status(400).json({ error: 'novel_id, title, and content are required' });
  }

  try {
    // Verify ownership
    const { data: novel } = await supabase
      .from('novels')
      .select('author_id')
      .eq('id', novel_id)
      .single();

    if (!novel) return res.status(404).json({ error: 'Novel not found' });
    if (novel.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your novel' });
    }

    // Auto-assign chapter number if not provided
    let chapterNum = chapter_number;
    if (!chapterNum) {
      const { count } = await supabase
        .from('chapters')
        .select('*', { count: 'exact' })
        .eq('novel_id', novel_id);
      chapterNum = (count || 0) + 1;
    }

    const { data: chapter, error } = await supabase
      .from('chapters')
      .insert({ novel_id, title, content, chapter_number: chapterNum })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ chapter });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chapters/:id — author edits chapter
router.put('/:id', authenticate, requireRole('author', 'admin'), async (req, res) => {
  const { title, content } = req.body;

  try {
    const { data: chapter } = await supabase
      .from('chapters')
      .select('novel_id')
      .eq('id', req.params.id)
      .single();

    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const { data: novel } = await supabase
      .from('novels')
      .select('author_id')
      .eq('id', chapter.novel_id)
      .single();

    if (novel.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your chapter' });
    }

    const { data: updated, error } = await supabase
      .from('chapters')
      .update({ title, content })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ chapter: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chapters/:id
router.delete('/:id', authenticate, requireRole('author', 'admin'), async (req, res) => {
  try {
    const { data: chapter } = await supabase
      .from('chapters')
      .select('novel_id')
      .eq('id', req.params.id)
      .single();

    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const { data: novel } = await supabase
      .from('novels')
      .select('author_id')
      .eq('id', chapter.novel_id)
      .single();

    if (novel.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your chapter' });
    }

    await supabase.from('chapters').delete().eq('id', req.params.id);
    res.json({ message: 'Chapter deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

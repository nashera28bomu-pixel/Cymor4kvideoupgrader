import express from 'express';
import supabase from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/bookmarks — get user's bookmarks
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        id, created_at,
        novel:novels(id, title, cover_image, description, author:users(username)),
        last_chapter:chapters(id, title, chapter_number)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ bookmarks: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookmarks/:novel_id — add bookmark
router.post('/:novel_id', async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('novel_id', req.params.novel_id)
      .single();

    if (existing) return res.status(409).json({ error: 'Already bookmarked' });

    const { data, error } = await supabase
      .from('bookmarks')
      .insert({ user_id: req.user.id, novel_id: req.params.novel_id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ bookmark: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookmarks/:novel_id — remove bookmark
router.delete('/:novel_id', async (req, res) => {
  try {
    await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', req.user.id)
      .eq('novel_id', req.params.novel_id);

    res.json({ message: 'Bookmark removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookmarks/progress — save reading progress
router.post('/progress/save', async (req, res) => {
  const { novel_id, chapter_id, scroll_position } = req.body;

  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .upsert(
        { user_id: req.user.id, novel_id, chapter_id, scroll_position, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,novel_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // Update bookmark's last_read_chapter
    await supabase
      .from('bookmarks')
      .update({ last_read_chapter_id: chapter_id })
      .eq('user_id', req.user.id)
      .eq('novel_id', novel_id);

    res.json({ progress: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookmarks/progress/:novel_id — get reading progress
router.get('/progress/:novel_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('chapter_id, scroll_position, updated_at')
      .eq('user_id', req.user.id)
      .eq('novel_id', req.params.novel_id)
      .single();

    if (error) return res.json({ progress: null });
    res.json({ progress: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

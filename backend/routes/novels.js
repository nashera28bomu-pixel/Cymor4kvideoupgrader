import express from 'express';
import supabase from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload } from '../lib/cloudinary.js';

const router = express.Router();

// GET /api/novels — public, approved only, with pagination + search
router.get('/', async (req, res) => {
  const { page = 1, limit = 12, search, genre } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('novels')
      .select(`
        id, title, description, cover_image, source, created_at,
        author:users(id, username),
        novel_genres(genre:genres(id, name, slug))
      `, { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ novels: data, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/novels/featured — top 6 featured
router.get('/featured', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('novels')
      .select(`id, title, description, cover_image, created_at, author:users(username)`)
      .eq('status', 'approved')
      .eq('featured', true)
      .limit(6);

    if (error) throw error;
    res.json({ novels: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/novels/:id — single novel with chapters list
router.get('/:id', async (req, res) => {
  try {
    const { data: novel, error } = await supabase
      .from('novels')
      .select(`
        *,
        author:users(id, username),
        chapters(id, title, chapter_number, created_at),
        novel_genres(genre:genres(id, name, slug))
      `)
      .eq('id', req.params.id)
      .eq('status', 'approved')
      .single();

    if (error || !novel) return res.status(404).json({ error: 'Novel not found' });

    // Sort chapters
    novel.chapters?.sort((a, b) => a.chapter_number - b.chapter_number);
    res.json({ novel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/novels — author creates novel
router.post('/', authenticate, requireRole('author', 'admin'), upload.single('cover'), async (req, res) => {
  const { title, description, genres } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const cover_image = req.file?.path || null;

    const { data: novel, error } = await supabase
      .from('novels')
      .insert({
        title,
        description,
        cover_image,
        author_id: req.user.id,
        source: 'manual',
        status: req.user.role === 'admin' ? 'approved' : 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    // Attach genres
    if (genres) {
      const genreList = JSON.parse(genres);
      if (genreList.length > 0) {
        const genreLinks = genreList.map((gid) => ({ novel_id: novel.id, genre_id: gid }));
        await supabase.from('novel_genres').insert(genreLinks);
      }
    }

    res.status(201).json({ novel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/novels/:id — author updates their novel
router.put('/:id', authenticate, requireRole('author', 'admin'), upload.single('cover'), async (req, res) => {
  const { title, description } = req.body;

  try {
    const { data: existing } = await supabase
      .from('novels')
      .select('author_id, status')
      .eq('id', req.params.id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Novel not found' });
    if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your novel' });
    }

    const updates = { title, description };
    if (req.file) updates.cover_image = req.file.path;
    // Reset to pending if author edits a rejected novel
    if (existing.status === 'rejected') updates.status = 'draft';

    const { data: novel, error } = await supabase
      .from('novels')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ novel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/novels/:id/submit — author submits novel for review
router.post('/:id/submit', authenticate, requireRole('author'), async (req, res) => {
  try {
    const { data: novel, error } = await supabase
      .from('novels')
      .update({ status: 'pending' })
      .eq('id', req.params.id)
      .eq('author_id', req.user.id)
      .in('status', ['draft', 'rejected'])
      .select()
      .single();

    if (error || !novel) return res.status(400).json({ error: 'Cannot submit this novel' });
    res.json({ novel, message: 'Submitted for review' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/novels/author/mine — author's own novels
router.get('/author/mine', authenticate, requireRole('author', 'admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('novels')
      .select('id, title, description, cover_image, status, created_at, chapters(id)')
      .eq('author_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ novels: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

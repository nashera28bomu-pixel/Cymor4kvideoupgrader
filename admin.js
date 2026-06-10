import express from 'express';
import supabase from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// GET /api/admin/pending — novels awaiting approval
router.get('/pending', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('novels')
      .select(`
        id, title, description, cover_image, created_at,
        author:users(id, username, email),
        chapters(id)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ novels: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/all — all novels with all statuses
router.get('/all', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('novels')
      .select(`id, title, status, source, created_at, author:users(username), chapters(id)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ novels: data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/approve/:id
router.post('/approve/:id', async (req, res) => {
  try {
    const { data: novel, error } = await supabase
      .from('novels')
      .update({ status: 'approved' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log approval
    await supabase.from('approvals').insert({
      novel_id: req.params.id,
      admin_id: req.user.id,
      status: 'approved',
    });

    res.json({ novel, message: 'Novel approved and published' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/reject/:id
router.post('/reject/:id', async (req, res) => {
  const { reason } = req.body;

  try {
    const { data: novel, error } = await supabase
      .from('novels')
      .update({ status: 'rejected' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('approvals').insert({
      novel_id: req.params.id,
      admin_id: req.user.id,
      status: 'rejected',
      reason: reason || 'No reason provided',
    });

    res.json({ novel, message: 'Novel rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/feature/:id — toggle featured
router.post('/feature/:id', async (req, res) => {
  const { featured } = req.body;

  try {
    const { data: novel, error } = await supabase
      .from('novels')
      .update({ featured: !!featured })
      .eq('id', req.params.id)
      .select('id, title, featured')
      .single();

    if (error) throw error;
    res.json({ novel, message: `Novel ${featured ? 'featured' : 'unfeatured'}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/novel/:id — hard delete
router.delete('/novel/:id', async (req, res) => {
  try {
    await supabase.from('chapters').delete().eq('novel_id', req.params.id);
    await supabase.from('novel_genres').delete().eq('novel_id', req.params.id);
    await supabase.from('approvals').delete().eq('novel_id', req.params.id);
    await supabase.from('bookmarks').delete().eq('novel_id', req.params.id);
    await supabase.from('reading_progress').delete().eq('novel_id', req.params.id);
    await supabase.from('novels').delete().eq('id', req.params.id);

    res.json({ message: 'Novel deleted permanently' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [novels, users, pending, chapters] = await Promise.all([
      supabase.from('novels').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('novels').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('chapters').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      stats: {
        total_novels: novels.count,
        total_users: users.count,
        pending_reviews: pending.count,
        total_chapters: chapters.count,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

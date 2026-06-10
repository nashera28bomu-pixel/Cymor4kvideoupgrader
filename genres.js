import express from 'express';
import supabase from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/genres — all genres
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('genres')
      .select('id, name, slug')
      .order('name');
    if (error) throw error;
    res.json({ genres: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/genres — admin only
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  try {
    const { data, error } = await supabase
      .from('genres')
      .insert({ name, slug })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ genre: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

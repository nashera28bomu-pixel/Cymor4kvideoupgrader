import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import novelRoutes from './routes/novels.js';
import chapterRoutes from './routes/chapters.js';
import adminRoutes from './routes/admin.js';
import seedRoutes from './routes/seed.js';
import bookmarkRoutes from './routes/bookmarks.js';
import genreRoutes from './routes/genres.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for Render)
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5500',
    'http://127.0.0.1:5500',
    /\.vercel\.app$/,
    /\.netlify\.app$/,
  ],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Rumion Novel Hub API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/genres', genreRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n📚 Rumion Novel Hub API running on port ${PORT}\n`);
});

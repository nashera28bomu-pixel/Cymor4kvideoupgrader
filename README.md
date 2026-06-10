# 🌹 Rumion Novel Hub

> *Where every story blooms — a romantic reading platform for hopeless readers*

A full-stack novel reading platform built with love. Readers can discover timeless classics and original stories. Authors can write and publish. Admins keep the quality high.

---

## ✨ Features

| Feature | Details |
|---|---|
| 📖 Reading | Chapter-by-chapter reader with dark mode, font resize, progress bar |
| 🔖 Bookmarks | Save novels, auto-resume where you left off |
| ✍️ Author tools | Create novels, add chapters, submit for review |
| 🛡️ Admin panel | Approve/reject/feature novels, import classics |
| 📚 Classic library | Import public-domain books from Project Gutenberg (free) |
| 🔍 Discovery | Search, genre filters, featured picks, pagination |
| 📱 PWA | Installable on mobile, offline-ready |

---

## 🗂️ Project Structure

```
rumion-novel-hub/
├── backend/                  ← Express.js API
│   ├── server.js             ← Entry point
│   ├── routes/
│   │   ├── auth.js           ← Register / Login / Me
│   │   ├── novels.js         ← Novel CRUD
│   │   ├── chapters.js       ← Chapter CRUD
│   │   ├── admin.js          ← Approve / Reject / Feature
│   │   ├── seed.js           ← Gutenberg import
│   │   ├── bookmarks.js      ← Bookmarks + reading progress
│   │   └── genres.js         ← Genre list
│   ├── middleware/
│   │   └── auth.js           ← JWT + role middleware
│   ├── lib/
│   │   ├── supabase.js       ← Supabase client
│   │   └── cloudinary.js     ← Image upload config
│   ├── .env.example          ← Copy to .env and fill in
│   └── package.json
│
├── frontend/                 ← Pure HTML/CSS/JS (PWA)
│   ├── index.html            ← Homepage
│   ├── css/main.css          ← Full design system
│   ├── js/api.js             ← API helper + auth utils
│   ├── manifest.json         ← PWA manifest
│   └── pages/
│       ├── login.html        ← Sign in
│       ├── register.html     ← Sign up
│       ├── discover.html     ← Browse + search
│       ├── novel.html        ← Novel detail + chapter list
│       ├── reader.html       ← Immersive chapter reader
│       ├── dashboard.html    ← Author: manage novels/chapters
│       ├── admin.html        ← Admin: approve/reject/import
│       └── bookmarks.html    ← My library
│
└── schema.sql                ← Run this in Supabase first!
```

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Supabase Database

1. Go to [supabase.com](https://supabase.com) → Create a new project
2. Go to **SQL Editor** in the left sidebar
3. Copy the entire contents of `schema.sql` and run it
4. Go to **Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (under "Project API keys") → `SUPABASE_SERVICE_KEY`

---

### Step 2 — Cloudinary (Cover Images)

1. Go to [cloudinary.com](https://cloudinary.com) → Create free account
2. From the Dashboard, copy:
   - Cloud name → `CLOUDINARY_CLOUD_NAME`
   - API Key → `CLOUDINARY_API_KEY`
   - API Secret → `CLOUDINARY_API_SECRET`

---

### Step 3 — Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in all values in .env

npm install
npm run dev     # development
npm start       # production
```

Your `.env` should look like:
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=make-this-long-and-random-like-rumion-secret-key-2025
CLOUDINARY_CLOUD_NAME=yourname
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abc123xyz
PORT=3000
FRONTEND_URL=http://localhost:5500
```

---

### Step 4 — Frontend Setup

The frontend is pure HTML — no build step needed.

Option A: **VS Code Live Server**
- Open the `frontend/` folder in VS Code
- Right-click `index.html` → *Open with Live Server*

Option B: **Any static server**
```bash
cd frontend
npx serve .
```

**IMPORTANT**: Open `frontend/js/api.js` and update line 2:
```js
const API_BASE = 'http://localhost:3000/api'; // during dev
```

---

### Step 5 — Create Your Admin Account

1. Register normally at `/pages/register.html`
2. Go to Supabase → Table Editor → `users`
3. Find your account and change `role` from `reader` to `admin`
4. Log out and back in — you now have the Admin panel

---

### Step 6 — Import Classic Novels

1. Log in as admin → go to `/pages/admin.html`
2. Click **"Import Classics"** tab
3. Optionally type a topic (e.g. `romance`, `mystery`)
4. Click **Import Books**
5. It fetches 10 books from Project Gutenberg with chapters

Recommended import topics:
- `romance` — Jane Austen, Brontë
- `mystery` — Sherlock Holmes, Agatha Christie era
- `adventure` — Jules Verne, H. Rider Haggard
- Leave blank for Gutenberg's top downloads

---

## ☁️ Deployment (Free Tier)

### Backend → Render

1. Push your `backend/` folder to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo, set:
   - **Build command**: `npm install`
   - **Start command**: `node server.js`
   - **Environment**: Add all your `.env` variables
4. Copy the Render URL (e.g. `https://rumion-api.onrender.com`)

### Frontend → Vercel

1. Push your `frontend/` folder to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the repo, set **Root Directory** to `frontend`
4. Before deploying, update `frontend/js/api.js`:
   ```js
   const API_BASE = 'https://rumion-api.onrender.com/api';
   ```
5. Also update `FRONTEND_URL` in your Render env vars to your Vercel URL

---

## 🔑 User Roles

| Role | Permissions |
|---|---|
| **Reader** | Browse, read, bookmark novels |
| **Author** | + Create novels, add chapters, submit for review |
| **Admin** | + Approve/reject novels, feature books, import classics, full management |

**Status flow for author novels:**
```
draft → [Submit] → pending → [Admin] → approved (published)
                                    ↘ rejected → draft (can resubmit)
```

---

## 📡 API Reference

```
POST /api/auth/register       Register new user
POST /api/auth/login          Login → returns JWT token
GET  /api/auth/me             Get current user

GET  /api/novels              All approved novels (search, genre, pagination)
GET  /api/novels/featured     Featured novels (homepage)
GET  /api/novels/:id          Single novel + chapters list
POST /api/novels              Create novel (author)
PUT  /api/novels/:id          Update novel (author/admin)
POST /api/novels/:id/submit   Submit for review (author)
GET  /api/novels/author/mine  My novels (author)

GET  /api/chapters/:id        Read a chapter
POST /api/chapters            Add chapter (author)
PUT  /api/chapters/:id        Edit chapter (author)

GET  /api/admin/pending       Novels awaiting approval
GET  /api/admin/stats         Platform stats
POST /api/admin/approve/:id   Approve novel
POST /api/admin/reject/:id    Reject novel
POST /api/admin/feature/:id   Feature/unfeature novel
GET  /api/admin/all           All novels with filters

POST /api/seed/import         Import from Gutenberg (admin)
GET  /api/seed/preview        Preview books without importing

GET  /api/bookmarks           My bookmarks
POST /api/bookmarks/:novel_id Add bookmark
DELETE /api/bookmarks/:id     Remove bookmark
POST /api/bookmarks/progress/save  Save reading progress
GET  /api/bookmarks/progress/:id   Get reading progress

GET  /api/genres              All genres
POST /api/genres              Add genre (admin)
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Node.js + Express | Familiar, fast, Render-friendly |
| Database | Supabase (PostgreSQL) | Free tier, REST API, auth built-in |
| Auth | JWT (jsonwebtoken) | Stateless, works on any host |
| Images | Cloudinary | Free 25GB, transforms on upload |
| Frontend | HTML + CSS + JS | No build step, deploys anywhere |
| Classics | Gutendex + Project Gutenberg | 100% free, no API key needed |
| Hosting BE | Render | Free tier, auto-deploy from GitHub |
| Hosting FE | Vercel | Free tier, CDN, fast |

---

## 💡 Tips

- **Cold starts on Render free tier**: The first request after inactivity may take ~30 seconds. This is normal.
- **Cover images**: Max 5MB. Cloudinary auto-resizes to 400×600px.
- **Chapter content**: No hard limit but recommend under 50,000 chars per chapter for best load times.
- **Mobile reading**: The reader page is dark-themed and optimised for phones. Font size persists in localStorage.

---

## ❤️ Built With Love

> *"Every great love story starts with the first page."*

**Rumion Novel Hub** — Built by [Cymor Tech Services](https://github.com/cymor)

*Inspired by the one who loves reading novels. For you. 🌹*

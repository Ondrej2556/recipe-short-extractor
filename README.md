# 🍳 AI Recipe Book (Receptář z krátkých videí)

A modern Next.js web application that extracts recipes directly from short-form video URLs (Instagram Reels, TikTok, YouTube Shorts). It extracts captions, descriptions, and pinned/top comments via `yt-dlp`, processes and structures the data using the Google Gemini API, translates it into Czech, and stores it in a Supabase PostgreSQL database.

---

## 🌟 Key Features

- **Automated Video Import:**
  - Paste an Instagram Reel, TikTok, or YouTube Shorts link.
  - Extracts title, thumbnail, and text metadata using `yt-dlp` on the server **without downloading the video file**.
  - Fallback logic fetches pinned, author, or most-liked comments if the recipe is not found in the description.
- **Smart Gemini AI Parsing:**
  - Extracts ingredients (quantity, unit, section/part) and numbered steps.
  - Translates foreign recipes cleanly into Czech.
  - Returns structured JSON according to a strict schema and marks whether the recipe is complete.
  - **High Availability & Retries:** Handles model overload (503) by retrying and falling back to a secondary model (`GEMINI_FALLBACK_MODEL`).
- **Interactive Recipe Collection:**
  - Responsive card grid with thumbnails.
  - Full-text search ignoring Czech diacritics across titles, ingredients, tags, and notes (`search_text`).
  - Filter by status (*Chci vyzkoušet* / *Vyzkoušeno*), minimum rating (1–5 ⭐), and top 10 most common tags.
  - Paginated loading (20 items per page with "Načíst další").
- **Detail & Cooking Mode:**
  - **Reading Mode:** Interactive checklist for ingredients categorized by component/part, step-by-step instructions, quick rating, and a "Uvařeno dnes" timestamp button.
  - **Editing Mode:** Full manual control to edit ingredients in a structured table, tags, notes, images, or delete entries.
  - **Manual Entry:** Add custom recipes from scratch without providing a video URL.
- **Backup & Portability:**
  - One-click export of all recipes to a JSON file.
  - Restore/import recipes from an existing JSON backup.

---

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **AI Processing:** Google Gemini API (`@google/genai` or `@google/generative-ai`)
- **Metadata Extraction:** `yt-dlp` (CLI tool)

---

## 📋 Prerequisites

Before running the application, make sure you have:

1. **Node.js** (v18.17+ or v20+)
2. **npm**, **pnpm**, or **yarn**
3. **yt-dlp** installed and added to your system `PATH`:
   - **Windows:**
     ```powershell
     winget install yt-dlp
     # or using scoop
     scoop install yt-dlp
     # or using choco
     choco install yt-dlp
     ```
   - Verify by running in terminal:
     ```bash
     yt-dlp --version
     ```
4. A **Supabase** account and project ([supabase.com](https://supabase.com))
5. A **Google Gemini API Key** ([Google AI Studio](https://aistudio.google.com/))

---

## 🗄️ Database Setup (Supabase)

Run the following SQL in your Supabase project's **SQL Editor** to create the required table and unaccented full-text search:

Schema can be found in /supabase/schema.sql
---

## ⚙️ Environment Variables

Create a file named `.env.local` (or `.env`) in the root directory of your project:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://myID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_myKEY

# Google Gemini API
GEMINI_API_KEY=MY_API_KEY
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
```

*(Note: Replace with your actual Supabase URL, anon key, and Gemini API key).*

---

## 🚀 Installation & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/recipe-book.git
   cd recipe-book
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Verify yt-dlp availability:**
   Ensure `yt-dlp` is accessible from your system command line:
   ```bash
   yt-dlp --version
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 📦 Backup & Restore (JSON)

- **Export:** In the application header or settings, click **Exportovat do JSON** to download a snapshot of all saved recipes.
- **Import:** Click **Obnovit ze souboru**, choose your exported `.json` file, and the application will bulk upsert the items directly into Supabase.

---

## 📄 License

This project is licensed under the MIT License.

## Photos
<img width="1004" height="1105" alt="image" src="https://github.com/user-attachments/assets/74921400-89ad-488c-9c85-e9d76b499c01" />
<img width="924" height="934" alt="image" src="https://github.com/user-attachments/assets/e3996601-1684-4b22-a2f1-fb3fb134ce68" />


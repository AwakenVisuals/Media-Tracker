# Media Tracker 🎬

Add films and TV shows to your Notion watchlist instantly - capture a screenshot or photo, and let AI identify the title.

## How It Works

1. **Apple Shortcut** → Takes screenshot/photo, uses on-device AI to extract text, sends to webapp
2. **Webapp** → Searches TMDB for the title, shows you matches to confirm
3. **Notion** → Automatically adds the selected media to your watchlist database

---

## Setup Guide

### Step 1: Get API Keys (5 minutes)

#### TMDB API Key (Free)
1. Go to [themoviedb.org](https://www.themoviedb.org/) and create an account
2. Go to Settings → API → Create → Developer
3. Fill in the form (use "Personal Project" for type)
4. Copy your **API Key** (v3 auth)

#### Notion Integration Token
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Name it "Media Tracker"
4. Select your workspace
5. Click **Submit**
6. Copy the **Internal Integration Token** (starts with `secret_`)

#### Connect Notion Integration to Your Database
1. Open your Media Tracker database in Notion
2. Click the **"..."** menu in the top right
3. Scroll down to **"Connections"**
4. Find and add **"Media Tracker"** (the integration you just created)

---

### Step 2: Deploy to Netlify (5 minutes)

#### Option A: Deploy via GitHub (Recommended)
1. Create a new repository on GitHub
2. Upload all files from this project to the repository
3. Go to [netlify.com](https://netlify.com) and sign up/login
4. Click **"Add new site"** → **"Import an existing project"**
5. Connect to GitHub and select your repository
6. Leave build settings as default, click **Deploy**

#### Option B: Deploy via Drag & Drop
1. Go to [netlify.com](https://netlify.com) and sign up/login
2. Drag the entire `media-tracker` folder onto the Netlify dashboard
3. Wait for deployment

---

### Step 3: Add Environment Variables

1. In Netlify, go to **Site settings** → **Environment variables**
2. Add these three variables:

| Key | Value |
|-----|-------|
| `TMDB_API_KEY` | Your TMDB API key |
| `NOTION_TOKEN` | Your Notion integration token (starts with `secret_`) |
| `NOTION_DATABASE_ID` | `2e83ae6e0396804e9a6af7933b74c3e4` |

3. Click **Save**
4. Go to **Deploys** → Click **"Trigger deploy"** → **"Deploy site"**

---

### Step 4: Create Apple Shortcut (5 minutes)

Create a new Shortcut in the Shortcuts app with these actions:

```
1. SHOW MENU
   - Option 1: "📷 Take Photo"
   - Option 2: "📱 Screenshot"

2. IF "Take Photo" selected:
   → TAKE PHOTO (Front Camera: Off, Show Preview: On)
   
3. IF "Screenshot" selected:
   → TAKE SCREENSHOT

4. EXTRACT TEXT FROM IMAGE (input: Photo/Screenshot)

5. ASK FOR INPUT
   - Prompt: "What's the title?"
   - Default: [Extracted Text]
   - (This lets you correct if OCR got it wrong)

6. OPEN URL
   - URL: https://YOUR-NETLIFY-SITE.netlify.app/?title=[Input]
   
   Replace YOUR-NETLIFY-SITE with your actual Netlify subdomain
```

#### Quick Setup Alternative:
You can simplify to just:
```
1. ASK FOR INPUT (Prompt: "Film/Show title?")
2. OPEN URL: https://YOUR-SITE.netlify.app/?title=[Input]
```

---

### Step 5: Add to Action Button (Optional)

1. Go to **Settings** → **Action Button**
2. Select **Shortcut**
3. Choose your Media Tracker shortcut

Or add to Control Center for quick access.

---

## Testing

1. Visit your Netlify URL directly (e.g., `https://your-site.netlify.app`)
2. Search for a film like "Inception"
3. Select it from results
4. Click "Add to Notion"
5. Check your Notion database!

---

## Troubleshooting

### "Notion credentials not configured"
- Make sure you've added all 3 environment variables in Netlify
- Trigger a new deploy after adding variables

### "Failed to add to Notion"
- Check that you've connected your Notion integration to the database
- Verify the database ID is correct

### Search returns no results
- Check your TMDB API key is correct
- Try a more specific search term

---

## File Structure

```
media-tracker/
├── public/
│   └── index.html          # The webapp UI
├── netlify/
│   └── functions/
│       ├── search.mjs      # TMDB search endpoint
│       ├── details.mjs     # TMDB details endpoint
│       └── add-to-notion.mjs # Notion integration
├── netlify.toml            # Netlify config
├── package.json
└── README.md
```

---

## What Gets Added to Notion

| Notion Field | Source |
|--------------|--------|
| Title | TMDB title |
| Media Type | Movie / TV Show |
| Status | "Want to Watch/Read/Play" |
| Notes | TMDB overview/synopsis |
| Cover Image | TMDB poster URL |
| Genre | Mapped from TMDB genres |
| Date Added | Current date |

---

## Credits

- Movie/TV data from [The Movie Database (TMDB)](https://www.themoviedb.org/)
- Built for Nick @ Awaken Visuals

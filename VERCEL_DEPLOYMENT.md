# 🚀 Deploy to Vercel (Free Hosting)

This guide will help you migrate from Netlify to Vercel for free hosting with a generous usage limit.

## Why Vercel?

- ✅ **Generous free tier**: 100GB bandwidth/month (vs Netlify's limits)
- ✅ **Fast edge functions**: Global CDN with low latency
- ✅ **Zero configuration**: Auto-detects and deploys
- ✅ **Free SSL**: Automatic HTTPS
- ✅ **Preview deployments**: Every PR gets a preview URL

## Prerequisites

- GitHub account with this repository
- Vercel account (free) - sign up at https://vercel.com

## Step 1: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel**: https://vercel.com/new
2. **Import your repository**:
   - Click "Import Project"
   - Select your GitHub account
   - Choose `AwakenVisuals/Media-Tracker`
3. **Configure project**:
   - Framework Preset: **Other**
   - Build Command: (leave empty)
   - Output Directory: `public`
   - Install Command: (leave empty)
4. **Add environment variables** (click "Environment Variables"):
   ```
   ANTHROPIC_API_KEY=<your-claude-api-key>
   TMDB_API_KEY=<your-tmdb-key>
   RAWG_API_KEY=<your-rawg-key>
   GOOGLE_BOOKS_API_KEY=<your-google-books-key>
   NOTION_TOKEN=<your-notion-token>
   NOTION_DATABASE_ID=<your-notion-database-id>
   ```
5. **Click "Deploy"**

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
cd /path/to/Media-Tracker
vercel

# Follow the prompts and add environment variables
```

## Step 2: Configure Automatic Deployments

Vercel automatically sets up:
- ✅ **Production deploys** when you push to `main`
- ✅ **Preview deploys** for every pull request
- ✅ **Branch deploys** for feature branches

No additional configuration needed!

## Step 3: Add Your API Keys

Go to your project settings on Vercel:

1. **Project Settings** → **Environment Variables**
2. Add all your API keys:

| Variable Name | Description | Where to Get |
|---------------|-------------|--------------|
| `ANTHROPIC_API_KEY` | Claude AI API key | https://console.anthropic.com |
| `TMDB_API_KEY` | The Movie Database API | https://www.themoviedb.org/settings/api |
| `RAWG_API_KEY` | Video game database API | https://rawg.io/apidocs |
| `GOOGLE_BOOKS_API_KEY` | Google Books API | https://console.cloud.google.com |
| `NOTION_TOKEN` | Notion integration token | https://www.notion.so/my-integrations |
| `NOTION_DATABASE_ID` | Your Notion database ID | From your database URL |

## Step 4: Update Notion Database (If Not Done)

Make sure your Notion database has these select field options:

### Media Type field - Add:
- `Anime`

### Platform/Service field - Add:
- `Crunchyroll`
- `Hidive`
- `Manga Plus`
- `VIZ`
- `ComiXology`

## Step 5: Test Your Deployment

1. **Get your Vercel URL**: `https://your-project.vercel.app`
2. **Test the app**:
   - Try searching for media
   - Test photo scanning
   - Try adding Japanese media like "The Night of Baba Yaga"
3. **Check logs**: Vercel Dashboard → Your Project → Logs

## 🎉 You're Done!

Your media tracker is now running on Vercel with:
- ✅ Automatic deployments
- ✅ Free hosting with generous limits
- ✅ Full Japanese media support
- ✅ Fast global performance

## Differences from Netlify

| Feature | Netlify | Vercel |
|---------|---------|--------|
| Functions location | `netlify/functions/` | `api/` |
| Environment vars | `Netlify.env.get()` | `process.env` |
| Runtime | Automatic | Edge runtime |
| Free bandwidth | Limited | 100GB/month |
| Build minutes | 300/month | Unlimited |

## Troubleshooting

### Functions not working?
- Check environment variables are set in Vercel dashboard
- Check function logs in Vercel dashboard

### API errors?
- Verify all API keys are correct
- Check API key quotas haven't been exceeded

### Build errors?
- Vercel should auto-detect the setup
- No build command needed for this project

## Removing Netlify (Optional)

Once you verify everything works on Vercel:

1. Go to Netlify dashboard
2. Select your site
3. **Site settings** → **General** → **Delete site**

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- GitHub Issues: Create an issue in your repository

// Netlify Function: Full pipeline - analyse image, search, and add to Notion
// This is the single endpoint the Apple Shortcut will call
export default async (request, context) => {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const ANTHROPIC_API_KEY = Netlify.env.get('ANTHROPIC_API_KEY');
    const TMDB_API_KEY = Netlify.env.get('TMDB_API_KEY');
    const RAWG_API_KEY = Netlify.env.get('RAWG_API_KEY');
    const GOOGLE_BOOKS_API_KEY = Netlify.env.get('GOOGLE_BOOKS_API_KEY');
    const NOTION_TOKEN = Netlify.env.get('NOTION_TOKEN');
    const NOTION_DATABASE_ID = Netlify.env.get('NOTION_DATABASE_ID');

    try {
        const { image } = await request.json();

        if (!image) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Image data is required' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Step 1: Analyse image with Claude Vision
        let base64Data = image;
        let mediaType = 'image/jpeg';
        
        if (image.startsWith('data:')) {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mediaType = matches[1];
                base64Data = matches[2];
            }
        }

        const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 500,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64Data
                                }
                            },
                            {
                                type: 'text',
                                text: `Identify what media this image shows. This could be:
- A movie or TV show (scene, poster, trailer screenshot, DVD cover)
- An anime (scene, poster, artwork)
- A video game (gameplay, cover art, menu screen)
- A book (cover, page, e-reader screen)
- An audiobook (cover art, app screenshot)
- A podcast (artwork, app screenshot)
- A manga/comic (cover, page)

Respond with ONLY a JSON object in this exact format, no other text:
{
  "title": "The exact title of the media",
  "type": "movie|tv|anime|game|book|audiobook|podcast|manga",
  "confidence": "high|medium|low"
}

If you cannot identify the media, respond with:
{
  "title": null,
  "type": null,
  "confidence": "none"
}

Be specific with titles - use the official English title where possible. For TV shows, identify the show name not the episode title.`
                            }
                        ]
                    }
                ]
            })
        });

        const analysisData = await analysisResponse.json();

        if (!analysisResponse.ok) {
            throw new Error(analysisData.error?.message || 'Failed to analyse image');
        }

        const responseText = analysisData.content[0]?.text || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Could not understand the image' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const identified = JSON.parse(jsonMatch[0]);

        if (!identified.title || identified.confidence === 'none') {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Could not identify media in this image' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Step 2: Search for the identified media
        const searchResult = await searchMedia(
            identified.title, 
            identified.type,
            { TMDB_API_KEY, RAWG_API_KEY, GOOGLE_BOOKS_API_KEY }
        );

        if (!searchResult) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Could not find "${identified.title}" in database`,
                identified: { title: identified.title, type: identified.type }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Step 3: Add to Notion
        const notionResult = await addToNotion(searchResult, NOTION_TOKEN, NOTION_DATABASE_ID);

        return new Response(JSON.stringify({
            success: true,
            title: searchResult.title,
            type: searchResult.mediaType,
            platform: searchResult.platform,
            notionUrl: notionResult.url
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Pipeline Error:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Something went wrong' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// Search functions (same as search.mjs but inline for the pipeline)
async function searchMedia(query, type, apiKeys) {
    const { TMDB_API_KEY, RAWG_API_KEY, GOOGLE_BOOKS_API_KEY } = apiKeys;

    switch (type) {
        case 'movie':
            return await searchTMDB(query, 'movie', TMDB_API_KEY);
        case 'tv':
            return await searchTMDB(query, 'tv', TMDB_API_KEY);
        case 'anime':
            return await searchAnime(query);
        case 'manga':
            return await searchManga(query);
        case 'book':
            return await searchBooks(query, GOOGLE_BOOKS_API_KEY, 'book');
        case 'audiobook':
            return await searchBooks(query, GOOGLE_BOOKS_API_KEY, 'audiobook');
        case 'podcast':
            return await searchPodcasts(query);
        case 'game':
            return await searchGames(query, RAWG_API_KEY);
        default:
            return await searchTMDB(query, 'multi', TMDB_API_KEY);
    }
}

async function searchTMDB(query, type, apiKey) {
    const endpoint = type === 'multi' ? 'search/multi' : `search/${type}`;
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.results?.length) return null;
    
    let results = data.results;
    if (type === 'multi') {
        results = results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    }
    
    if (!results.length) return null;
    
    const item = results[0];
    const isMovie = item.media_type === 'movie' || type === 'movie';
    const mediaTypeResult = isMovie ? 'movie' : 'tv';
    
    const providersUrl = `https://api.themoviedb.org/3/${mediaTypeResult}/${item.id}/watch/providers?api_key=${apiKey}`;
    const providersResponse = await fetch(providersUrl);
    const providersData = await providersResponse.json();
    
    const platform = getUKStreamingPlatform(providersData.results?.GB);
    
    return {
        mediaType: mediaTypeResult,
        title: isMovie ? item.title : item.name,
        year: (isMovie ? item.release_date : item.first_air_date)?.substring(0, 4) || '',
        overview: item.overview || '',
        imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        platform,
        genres: [],
        externalUrl: `https://www.themoviedb.org/${mediaTypeResult}/${item.id}`
    };
}

function getUKStreamingPlatform(ukData) {
    if (!ukData) return null;
    
    const streamingProviders = [
        ...(ukData.flatrate || []),
        ...(ukData.free || []),
        ...(ukData.ads || [])
    ];
    
    const providerMap = {
        'Netflix': 'Netflix',
        'Amazon Prime Video': 'Amazon Prime',
        'Disney Plus': 'Disney+',
        'Apple TV Plus': 'Apple TV+',
        'Apple TV+': 'Apple TV+',
        'NOW': 'NOW TV',
        'Now TV': 'NOW TV',
        'BBC iPlayer': 'BBC iPlayer',
        'ITVX': 'ITVX',
        'Channel 4': 'Channel 4',
        'All 4': 'Channel 4',
        'Paramount Plus': 'Paramount+',
        'Paramount+': 'Paramount+',
        'YouTube': 'YouTube',
        'Crunchyroll': 'Crunchyroll'
    };
    
    for (const provider of streamingProviders) {
        const mapped = providerMap[provider.provider_name];
        if (mapped) return mapped;
    }
    
    return null;
}

async function searchBooks(query, apiKey, type = 'book') {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.items?.length) return null;
    
    const item = data.items[0];
    const info = item.volumeInfo;
    
    const isAudiobook = type === 'audiobook';
    
    return {
        mediaType: isAudiobook ? 'audiobook' : 'book',
        title: info.title,
        year: info.publishedDate?.substring(0, 4) || '',
        overview: info.description || '',
        imageUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
        platform: isAudiobook ? 'Audible' : 'Kindle',
        externalUrl: info.infoLink || `https://books.google.com/books?id=${item.id}`
    };
}

async function searchGames(query, apiKey) {
    const url = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=5`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.results?.length) return null;
    
    const item = data.results[0];
    
    let platform = 'Steam';
    if (item.stores?.length) {
        const storeMap = {
            'steam': 'Steam',
            'playstation-store': 'PlayStation Store',
            'xbox-store': 'Xbox',
            'nintendo': 'Nintendo'
        };
        
        for (const store of item.stores) {
            const mapped = storeMap[store.store?.slug];
            if (mapped) {
                platform = mapped;
                break;
            }
        }
    }
    
    return {
        mediaType: 'game',
        title: item.name,
        year: item.released?.substring(0, 4) || '',
        overview: '',
        imageUrl: item.background_image || null,
        platform,
        externalUrl: `https://rawg.io/games/${item.slug}`
    };
}

async function searchAnime(query) {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.data?.length) return null;
    
    const item = data.data[0];
    
    let platform = 'Crunchyroll';
    if (item.streaming?.length) {
        const streamMap = {
            'Crunchyroll': 'Crunchyroll',
            'Netflix': 'Netflix',
            'Amazon Prime Video': 'Amazon Prime'
        };
        
        for (const stream of item.streaming) {
            const mapped = streamMap[stream.name];
            if (mapped) {
                platform = mapped;
                break;
            }
        }
    }
    
    return {
        mediaType: 'anime',
        title: item.title_english || item.title,
        year: item.aired?.prop?.from?.year?.toString() || '',
        overview: item.synopsis || '',
        imageUrl: item.images?.jpg?.large_image_url || null,
        platform,
        externalUrl: item.url
    };
}

async function searchManga(query) {
    const url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=5`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.data?.length) return null;
    
    const item = data.data[0];
    
    return {
        mediaType: 'manga',
        title: item.title_english || item.title,
        year: item.published?.prop?.from?.year?.toString() || '',
        overview: item.synopsis || '',
        imageUrl: item.images?.jpg?.large_image_url || null,
        platform: 'Kindle',
        externalUrl: item.url
    };
}

async function searchPodcasts(query) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=5&country=gb`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || !data.results?.length) return null;
    
    const item = data.results[0];
    
    return {
        mediaType: 'podcast',
        title: item.collectionName || item.trackName,
        year: item.releaseDate?.substring(0, 4) || '',
        overview: item.description || '',
        imageUrl: item.artworkUrl600 || item.artworkUrl100 || null,
        platform: 'Apple Podcasts',
        externalUrl: item.collectionViewUrl || item.trackViewUrl
    };
}

// Add to Notion
async function addToNotion(media, token, databaseId) {
    const mediaTypeMap = {
        'movie': 'Movie',
        'tv': 'TV Show',
        'anime': 'TV Show',
        'book': 'Book',
        'audiobook': 'Audiobook',
        'podcast': 'Podcast',
        'game': 'Video Game',
        'manga': 'Comic/Manga'
    };
    
    const platformMap = {
        'Netflix': 'Netflix',
        'Amazon Prime': 'Amazon Prime',
        'Disney+': 'Disney+',
        'Apple TV+': 'Apple TV+',
        'NOW TV': 'NOW TV',
        'BBC iPlayer': 'BBC iPlayer',
        'ITVX': 'ITVX',
        'Channel 4': 'Channel 4',
        'Paramount+': 'Paramount+',
        'Apple Podcasts': 'Apple Podcasts',
        'YouTube': 'YouTube',
        'Steam': 'Steam',
        'PlayStation Store': 'PlayStation Store',
        'Audible': 'Audible',
        'Kindle': 'Kindle',
        'Crunchyroll': 'Other'
    };

    const properties = {
        'Title': {
            title: [{ text: { content: media.title } }]
        },
        'Media Type': {
            select: { name: mediaTypeMap[media.mediaType] || 'Other' }
        },
        'Status': {
            status: { name: 'Want to Watch/Read/Play' }
        },
        'Date Added': {
            date: { start: new Date().toISOString().split('T')[0] }
        }
    };

    if (media.overview) {
        properties['Notes'] = {
            rich_text: [{ text: { content: media.overview.substring(0, 2000) } }]
        };
    }

    if (media.externalUrl) {
        properties['URL'] = { url: media.externalUrl };
    }

    if (media.imageUrl) {
        properties['Cover Image'] = { url: media.imageUrl };
    }

    if (media.platform && platformMap[media.platform]) {
        properties['Platform/Service'] = {
            select: { name: platformMap[media.platform] }
        };
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
            parent: { database_id: databaseId },
            properties
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to add to Notion');
    }

    return data;
}

export const config = {
    path: "/api/add-from-image"
};

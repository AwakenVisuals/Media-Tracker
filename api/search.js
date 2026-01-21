// Netlify Function: Unified search across all media types
export default async (request) => {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const RAWG_API_KEY = process.env.RAWG_API_KEY;
    const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

    try {
        const { query, type } = await request.json();

        if (!query) {
            return new Response(JSON.stringify({ error: 'Query is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let results = [];

        if (type === 'auto') {
            // Auto-detect: search multiple APIs and return top matches
            const searchResults = await Promise.allSettled([
                searchTMDB(query, 'multi', TMDB_API_KEY),
                searchBooks(query, GOOGLE_BOOKS_API_KEY),
                searchGames(query, RAWG_API_KEY),
                searchAnime(query),
                searchPodcasts(query)
            ]);

            // Collect all results from all sources
            const candidates = [];

            searchResults.forEach((r, i) => {
                if (r.status === 'fulfilled' && r.value && Array.isArray(r.value)) {
                    candidates.push(...r.value);
                }
            });

            // Sort by score (popularity/relevance)
            candidates.sort((a, b) => (b.score || 0) - (a.score || 0));

            // Return top 10 results
            results = candidates.slice(0, 10);

        } else {
            // Specific type requested
            switch (type) {
                case 'movie':
                    results = await searchTMDB(query, 'movie', TMDB_API_KEY);
                    break;
                case 'tv':
                    results = await searchTMDB(query, 'tv', TMDB_API_KEY);
                    break;
                case 'anime':
                    // Try Jikan first, fallback to TMDB if Jikan fails
                    results = await searchAnime(query);
                    if (!results || results.length === 0) {
                        // Fallback to TMDB for anime that might be listed there
                        const tmdbResults = await searchTMDB(query, 'tv', TMDB_API_KEY);
                        if (tmdbResults && tmdbResults.length > 0) {
                            // Mark all results as anime instead of tv
                            results = tmdbResults.map(r => ({ ...r, mediaType: 'anime' }));
                        }
                    }
                    break;
                case 'manga':
                    results = await searchManga(query);
                    break;
                case 'book':
                    results = await searchBooks(query, GOOGLE_BOOKS_API_KEY, 'book');
                    break;
                case 'audiobook':
                    results = await searchBooks(query, GOOGLE_BOOKS_API_KEY, 'audiobook');
                    break;
                case 'podcast':
                    results = await searchPodcasts(query);
                    break;
                case 'game':
                    results = await searchGames(query, RAWG_API_KEY);
                    break;
                default:
                    results = await searchTMDB(query, 'multi', TMDB_API_KEY);
            }
        }

        return new Response(JSON.stringify({ results: results || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Search Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Search failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// Search TMDB for movies/TV shows
async function searchTMDB(query, type, apiKey) {
    const endpoint = type === 'multi' ? 'search/multi' : `search/${type}`;
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.results?.length) return [];

    // Filter to movies and TV only
    let results = data.results;
    if (type === 'multi') {
        results = results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    }

    if (!results.length) return [];

    // Return top 5 results
    const topResults = results.slice(0, 5);

    // Map each result to our format
    return await Promise.all(topResults.map(async (item) => {
        const isMovie = item.media_type === 'movie' || type === 'movie';
        const mediaType = isMovie ? 'movie' : 'tv';

        // Get watch providers for UK
        const providersUrl = `https://api.themoviedb.org/3/${mediaType}/${item.id}/watch/providers?api_key=${apiKey}`;
        const providersResponse = await fetch(providersUrl);
        const providersData = await providersResponse.json();

        const platform = getUKStreamingPlatform(providersData.results?.GB);

        return {
            mediaType,
            title: isMovie ? item.title : item.name,
            year: (isMovie ? item.release_date : item.first_air_date)?.substring(0, 4) || '',
            overview: item.overview || '',
            imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            platform,
            genres: [], // Will be fetched in details if needed
            externalUrl: `https://www.themoviedb.org/${mediaType}/${item.id}`,
            score: item.popularity || 0
        };
    }));
}

// Get UK streaming platform from TMDB providers
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
        'NOW TV Cinema': 'NOW TV',
        'BBC iPlayer': 'BBC iPlayer',
        'ITVX': 'ITVX',
        'ITV Hub': 'ITVX',
        'Channel 4': 'Channel 4',
        'All 4': 'Channel 4',
        'Paramount Plus': 'Paramount+',
        'Paramount+': 'Paramount+',
        'YouTube': 'YouTube',
        'YouTube Premium': 'YouTube',
        'Crunchyroll': 'Crunchyroll'
    };
    
    for (const provider of streamingProviders) {
        const mapped = providerMap[provider.provider_name];
        if (mapped) return mapped;
    }
    
    return null;
}

// Search Google Books
async function searchBooks(query, apiKey, type = 'book') {
    // Try multiple search strategies for better Japanese book coverage
    // 1. Try exact title search first
    let url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&key=${apiKey}&maxResults=5&langRestrict=en`;
    let response = await fetch(url);
    let data = await response.json();

    // 2. If no results, try broader search including international editions
    if (!response.ok || !data.items?.length) {
        url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5`;
        response = await fetch(url);
        data = await response.json();
    }

    // 3. Try with "japanese" keyword
    if (!response.ok || !data.items?.length) {
        url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query + ' japanese')}&key=${apiKey}&maxResults=5`;
        response = await fetch(url);
        data = await response.json();
    }

    // 4. Try with "novel" keyword for fiction
    if (!response.ok || !data.items?.length) {
        url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query + ' novel')}&key=${apiKey}&maxResults=5`;
        response = await fetch(url);
        data = await response.json();
    }

    // 5. Try removing common articles (The, A, An) from the beginning
    if (!response.ok || !data.items?.length) {
        const cleanedQuery = query.replace(/^(The|A|An)\s+/i, '');
        if (cleanedQuery !== query) {
            url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanedQuery)}&key=${apiKey}&maxResults=5`;
            response = await fetch(url);
            data = await response.json();
        }
    }

    // 6. Last resort: try with partial title (first few words)
    if (!response.ok || !data.items?.length) {
        const words = query.split(' ');
        if (words.length > 3) {
            const partialQuery = words.slice(0, 3).join(' ');
            url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(partialQuery)}&key=${apiKey}&maxResults=10`;
            response = await fetch(url);
            data = await response.json();
        }
    }

    if (!response.ok || !data.items?.length) return [];

    // Map all results to our format
    return data.items.map(item => {
        const info = item.volumeInfo;

        // Determine if audiobook based on categories or format
        const isAudiobook = type === 'audiobook' ||
            info.categories?.some(c => c.toLowerCase().includes('audio')) ||
            info.printType === 'AUDIOBOOK';

        return {
            mediaType: isAudiobook ? 'audiobook' : 'book',
            title: info.title,
            year: info.publishedDate?.substring(0, 4) || '',
            overview: info.description || '',
            imageUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
            platform: isAudiobook ? 'Audible' : 'Kindle',
            author: info.authors?.join(', ') || '',
            externalUrl: info.infoLink || `https://books.google.com/books?id=${item.id}`,
            score: (info.ratingsCount || 0) * (info.averageRating || 3)
        };
    });
}

// Search RAWG for video games
async function searchGames(query, apiKey) {
    const url = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=5`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.results?.length) return [];

    // Map all results to our format
    return data.results.map(item => {
        // Determine platform from stores
        let platform = null;
        if (item.stores?.length) {
            const storeMap = {
                'steam': 'Steam',
                'playstation-store': 'PlayStation Store',
                'xbox-store': 'Xbox',
                'nintendo': 'Nintendo',
                'epic-games': 'Epic Games',
                'gog': 'GOG'
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
            overview: '', // RAWG doesn't include description in search
            imageUrl: item.background_image || null,
            platform: platform || 'Steam',
            genres: item.genres?.map(g => g.name) || [],
            externalUrl: `https://rawg.io/games/${item.slug}`,
            score: (item.ratings_count || 0) * (item.rating || 3)
        };
    });
}

// Search Jikan (MyAnimeList) for anime
async function searchAnime(query) {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.data?.length) return [];

    // Map all results to our format
    return data.data.map(item => {
        // Determine streaming platform
        let platform = null;
        if (item.streaming?.length) {
            const streamMap = {
                'Crunchyroll': 'Crunchyroll',
                'Netflix': 'Netflix',
                'Amazon Prime Video': 'Amazon Prime',
                'Disney Plus': 'Disney+',
                'Funimation': 'Crunchyroll' // Funimation merged with Crunchyroll
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
            imageUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
            platform: platform || 'Crunchyroll',
            genres: item.genres?.map(g => g.name) || [],
            externalUrl: item.url,
            score: (item.members || 0) / 1000 // Normalize score
        };
    });
}

// Search Jikan for manga
async function searchManga(query) {
    const url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=5`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.data?.length) return [];

    // Map all results to our format
    return data.data.map(item => {
        // Smart platform detection for manga
        let platform = 'Kindle'; // Default fallback

        // Check if it's published by VIZ (Shueisha, Shogakukan, or Hakusensha titles)
        const vizPublishers = ['Shueisha', 'Shogakukan', 'Hakusensha'];
        const publishers = item.serializations?.map(s => s.name) || [];

        // Popular Weekly Shonen Jump titles are on Manga Plus
        const jumpMagazines = ['Shounen Jump', 'Weekly Shounen Jump', 'Jump SQ', 'Shonen Jump'];
        const magazines = item.serializations?.map(s => s.name) || [];

        if (magazines.some(mag => jumpMagazines.some(jump => mag.includes(jump)))) {
            platform = 'Manga Plus';
        } else if (publishers.some(pub => vizPublishers.some(viz => pub.includes(viz)))) {
            platform = 'VIZ';
        } else if (item.score && item.score > 8.0) {
            // High-rated manga often available on VIZ or Manga Plus
            platform = 'VIZ';
        }

        return {
            mediaType: 'manga',
            title: item.title_english || item.title,
            year: item.published?.prop?.from?.year?.toString() || '',
            overview: item.synopsis || '',
            imageUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
            platform,
            genres: item.genres?.map(g => g.name) || [],
            externalUrl: item.url,
            score: (item.members || 0) / 1000
        };
    });
}

// Search iTunes for podcasts
async function searchPodcasts(query) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=5&country=gb`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.results?.length) return [];

    // Map all results to our format
    return data.results.map(item => {
        return {
            mediaType: 'podcast',
            title: item.collectionName || item.trackName,
            year: item.releaseDate?.substring(0, 4) || '',
            overview: item.description || '',
            imageUrl: item.artworkUrl600 || item.artworkUrl100 || null,
            platform: 'Apple Podcasts',
            author: item.artistName || '',
            genres: item.genres || [],
            externalUrl: item.collectionViewUrl || item.trackViewUrl,
            score: item.trackCount || 0 // Use episode count as popularity proxy
        };
    });
}

export const config = { runtime: "edge" };

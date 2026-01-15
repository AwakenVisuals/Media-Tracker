// Netlify Function: Add any media type to Notion database
export default async (request, context) => {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const NOTION_TOKEN = Netlify.env.get('NOTION_TOKEN');
    const NOTION_DATABASE_ID = Netlify.env.get('NOTION_DATABASE_ID');

    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
        return new Response(JSON.stringify({ error: 'Notion credentials not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const media = await request.json();
        
        // Map media type to Notion's options
        const mediaTypeMap = {
            'movie': 'Movie',
            'tv': 'TV Show',
            'anime': 'TV Show', // Anime goes under TV Show
            'book': 'Book',
            'audiobook': 'Audiobook',
            'podcast': 'Podcast',
            'game': 'Video Game',
            'manga': 'Comic/Manga'
        };
        
        // Map platform to Notion's options
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
            'Crunchyroll': 'Other', // Map to Other if not in list
            'Xbox': 'Other',
            'Nintendo': 'Other',
            'Epic Games': 'Other',
            'GOG': 'Other'
        };

        // Map genres to Notion's available options
        const genreMap = {
            'Action': 'Action',
            'Adventure': 'Action',
            'Animation': 'Animation',
            'Comedy': 'Comedy',
            'Crime': 'Thriller',
            'Documentary': 'Documentary',
            'Drama': 'Drama',
            'Family': 'Comedy',
            'Fantasy': 'Fantasy',
            'History': 'Drama',
            'Horror': 'Horror',
            'Music': 'Drama',
            'Mystery': 'Thriller',
            'Romance': 'Romance',
            'Science Fiction': 'Sci-Fi',
            'Sci-Fi': 'Sci-Fi',
            'Sci-Fi & Fantasy': 'Sci-Fi',
            'TV Movie': 'Drama',
            'Thriller': 'Thriller',
            'War': 'Action',
            'War & Politics': 'Drama',
            'Western': 'Action',
            'Action & Adventure': 'Action',
            'Kids': 'Animation',
            'News': 'Documentary',
            'Reality': 'Documentary',
            'Soap': 'Drama',
            'Talk': 'Documentary',
            // Game genres
            'RPG': 'Fantasy',
            'Shooter': 'Action',
            'Puzzle': 'Comedy',
            'Sports': 'Action',
            'Racing': 'Action',
            'Simulation': 'Documentary',
            'Strategy': 'Thriller',
            // Anime/Manga genres
            'Shounen': 'Action',
            'Shoujo': 'Romance',
            'Seinen': 'Drama',
            'Josei': 'Drama',
            'Slice of Life': 'Drama',
            'Supernatural': 'Fantasy',
            'Psychological': 'Thriller',
            'Mecha': 'Sci-Fi'
        };

        // Map genres
        const genres = (media.genres || [])
            .map(g => genreMap[g])
            .filter(g => g)
            .filter((g, i, arr) => arr.indexOf(g) === i);

        // Build Notion page properties
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

        // Add notes/overview if available
        if (media.overview) {
            properties['Notes'] = {
                rich_text: [{ text: { content: media.overview.substring(0, 2000) } }]
            };
        }

        // Add URL if available
        if (media.externalUrl) {
            properties['URL'] = {
                url: media.externalUrl
            };
        }

        // Add cover image if available
        if (media.imageUrl) {
            properties['Cover Image'] = {
                url: media.imageUrl
            };
        }

        // Add platform if available and valid
        if (media.platform) {
            const notionPlatform = platformMap[media.platform];
            if (notionPlatform) {
                properties['Platform/Service'] = {
                    select: { name: notionPlatform }
                };
            }
        }

        // Add genres if any matched
        if (genres.length > 0) {
            properties['Genre'] = {
                multi_select: genres.map(g => ({ name: g }))
            };
        }

        // Create page in Notion
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: NOTION_DATABASE_ID },
                properties
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Notion API Error:', data);
            throw new Error(data.message || 'Failed to add to Notion');
        }

        return new Response(JSON.stringify({ 
            success: true, 
            pageId: data.id,
            url: data.url
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Add to Notion Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to add to Notion' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const config = {
    path: "/api/add-to-notion"
};

// Netlify Function: Add media to Notion database
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
        const isMovie = media.type === 'movie';
        
        // Extract data
        const title = isMovie ? media.title : media.name;
        const overview = media.overview || '';
        const posterUrl = media.poster_path 
            ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
            : null;
        
        // Map TMDB genres to your Notion genres
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
            'Talk': 'Documentary'
        };

        // Map genres from TMDB to Notion's available options
        const genres = (media.genres || [])
            .map(g => genreMap[g.name])
            .filter(g => g) // Remove undefined
            .filter((g, i, arr) => arr.indexOf(g) === i); // Remove duplicates

        // Build Notion page properties
        const properties = {
            'Title': {
                title: [{ text: { content: title } }]
            },
            'Media Type': {
                select: { name: isMovie ? 'Movie' : 'TV Show' }
            },
            'Status': {
                status: { name: 'Want to Watch/Read/Play' }
            },
            'Notes': {
                rich_text: overview ? [{ text: { content: overview.substring(0, 2000) } }] : []
            },
            'Date Added': {
                date: { start: new Date().toISOString().split('T')[0] }
            }
        };

        // Add poster URL if available
        if (posterUrl) {
            properties['Cover Image'] = { url: posterUrl };
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

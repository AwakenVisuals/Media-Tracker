// Netlify Function: Search TMDB for movies/TV shows
export default async (request, context) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const type = url.searchParams.get('type') || 'multi';

    if (!query) {
        return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const TMDB_API_KEY = Netlify.env.get('TMDB_API_KEY');

    if (!TMDB_API_KEY) {
        return new Response(JSON.stringify({ error: 'TMDB API key not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Search endpoint varies by type
        const endpoint = type === 'multi' 
            ? 'search/multi'
            : type === 'movie' 
                ? 'search/movie' 
                : 'search/tv';

        const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
        
        const response = await fetch(tmdbUrl);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.status_message || 'TMDB API error');
        }

        // Filter to only movies and TV shows (remove people, etc.)
        let results = data.results || [];
        if (type === 'multi') {
            results = results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        } else {
            // Add media_type to results since single-type searches don't include it
            results = results.map(item => ({ ...item, media_type: type }));
        }

        // Limit to top 10 results
        results = results.slice(0, 10);

        return new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('TMDB Search Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Search failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const config = {
    path: "/api/search"
};

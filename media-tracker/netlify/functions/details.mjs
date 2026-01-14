// Netlify Function: Get detailed info from TMDB
export default async (request, context) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type');

    if (!id || !type) {
        return new Response(JSON.stringify({ error: 'ID and type parameters are required' }), {
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
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`;
        
        const response = await fetch(tmdbUrl);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.status_message || 'TMDB API error');
        }

        // Add type to the response
        data.type = type;

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('TMDB Details Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to fetch details' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const config = {
    path: "/api/details"
};

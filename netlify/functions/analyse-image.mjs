// Netlify Function: Analyse image using Claude Vision to identify media
export default async (request, context) => {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const ANTHROPIC_API_KEY = Netlify.env.get('ANTHROPIC_API_KEY');

    if (!ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { image } = await request.json();

        if (!image) {
            return new Response(JSON.stringify({ error: 'Image data is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Remove data URL prefix if present
        let base64Data = image;
        let mediaType = 'image/jpeg';
        
        if (image.startsWith('data:')) {
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mediaType = matches[1];
                base64Data = matches[2];
            }
        }

        // Call Claude Vision API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
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

        const data = await response.json();

        if (!response.ok) {
            console.error('Claude API Error:', data);
            throw new Error(data.error?.message || 'Failed to analyse image');
        }

        // Parse Claude's response
        const responseText = data.content[0]?.text || '';
        
        // Extract JSON from response (in case there's any extra text)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse response');
        }

        const result = JSON.parse(jsonMatch[0]);

        if (!result.title || result.confidence === 'none') {
            return new Response(JSON.stringify({ 
                identified: false,
                message: 'Could not identify the media in this image'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            identified: true,
            title: result.title,
            type: result.type,
            confidence: result.confidence
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Image Analysis Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to analyse image' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const config = {
    path: "/api/analyse-image"
};

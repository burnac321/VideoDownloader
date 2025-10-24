export async function onRequestPost(context) {
    try {
        const { url } = await context.request.json();
        
        if (!url) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'No URL provided' 
            }), { status: 400 });
        }

        // Use a simple proxy approach since we can't install youtube-dl-exec in Workers
        const response = await fetch(`https://api.vevio.com/api/vevio/8/convert?url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch video info');
        }

        const data = await response.json();
        
        // Extract download links from the API response
        const downloadLinks = data.links || [];
        const bestQuality = downloadLinks.find(link => link.quality === '720p') || downloadLinks[0];

        return new Response(JSON.stringify({
            success: true,
            title: data.meta?.title || 'Video',
            downloadUrl: bestQuality?.url || '',
            googleVideoUrl: null, // This API doesn't provide googlevideo URLs
            thumbnail: data.meta?.thumbnail || ''
        }));

    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: `Failed to process video: ${error.message}` 
        }), { status: 500 });
    }
                            }

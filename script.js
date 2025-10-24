async function extractVideoLinks() {
    const videoUrl = document.getElementById('videoUrl').value;
    const resultDiv = document.getElementById('result');
    const progressDiv = document.getElementById('progress');
    
    if (!videoUrl) {
        showError('Please enter a video URL');
        return;
    }

    // Show progress
    progressDiv.style.display = 'block';
    resultDiv.innerHTML = '';

    try {
        let directUrls = [];
        
        if (isYouTubeUrl(videoUrl)) {
            directUrls = await extractYouTubeLinks(videoUrl);
        } else if (isFacebookUrl(videoUrl)) {
            directUrls = await extractFacebookLinks(videoUrl);
        } else {
            // For direct video URLs or your own site
            directUrls = [{
                url: videoUrl,
                quality: 'Direct',
                type: 'Direct Link'
            }];
        }

        displayResults(directUrls, videoUrl);
        
    } catch (error) {
        showError(`Failed to extract links: ${error.message}`);
    } finally {
        progressDiv.style.display = 'none';
    }
}

function isYouTubeUrl(url) {
    return url.includes('youtube.com') || url.includes('youtu.be');
}

function isFacebookUrl(url) {
    return url.includes('facebook.com') || url.includes('fb.watch');
}

async function extractYouTubeLinks(youtubeUrl) {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    // Method 1: Try to fetch video page and extract googlevideo URLs
    const response = await fetch(youtubeUrl);
    const html = await response.text();
    
    // Look for googlevideo.com URLs in the page source
    const googleVideoUrls = extractGoogleVideoUrls(html);
    
    if (googleVideoUrls.length > 0) {
        return googleVideoUrls;
    }
    
    // Method 2: Use YouTube player API as fallback
    return await extractViaPlayerAPI(videoId);
}

function extractGoogleVideoUrls(html) {
    const urls = [];
    const regex = /https:\/\/[a-z0-9]+\.googlevideo\.com\/[^"'\s]*/gi;
    const matches = html.match(regex);
    
    if (matches) {
        matches.forEach(url => {
            if (url.includes('videoplayback')) {
                // Clean the URL - remove unnecessary parameters
                const cleanUrl = cleanGoogleVideoUrl(url);
                urls.push({
                    url: cleanUrl,
                    quality: extractQualityFromUrl(url),
                    type: 'Google Video Direct'
                });
            }
        });
    }
    
    return urls;
}

function cleanGoogleVideoUrl(url) {
    // Remove tracking parameters but keep essential ones
    const urlObj = new URL(url);
    const essentialParams = ['ip', 'id', 'itag', 'source', 'requiressl', 'mime', 'ratebypass'];
    
    for (const param of urlObj.searchParams.keys()) {
        if (!essentialParams.includes(param)) {
            urlObj.searchParams.delete(param);
        }
    }
    
    return urlObj.toString();
}

function extractQualityFromUrl(url) {
    const itagMatch = url.match(/itag=(\d+)/);
    if (itagMatch) {
        const itag = itagMatch[1];
        const qualityMap = {
            '18': '360p', '59': '480p', '22': '720p', '37': '1080p',
            '137': '1080p', '248': '1080p', '136': '720p', '135': '480p'
        };
        return qualityMap[itag] || `itag:${itag}`;
    }
    return 'Unknown';
}

async function extractViaPlayerAPI(videoId) {
    // This method uses YouTube's player info to get available formats
    const infoUrl = `https://www.youtube.com/get_video_info?video_id=${videoId}&el=embedded&ps=default`;
    
    const response = await fetch(infoUrl);
    const data = await response.text();
    
    const urlParams = new URLSearchParams(data);
    const playerResponse = urlParams.get('player_response');
    
    if (playerResponse) {
        const playerData = JSON.parse(playerResponse);
        const streamingData = playerData.streamingData;
        
        if (streamingData) {
            const formats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];
            return formats.map(format => ({
                url: format.url,
                quality: format.qualityLabel || format.quality,
                type: format.mimeType?.split(';')[0] || 'Video'
            }));
        }
    }
    
    throw new Error('Could not extract video links');
}

async function extractFacebookLinks(facebookUrl) {
    // For Facebook, we need to use a different approach
    const response = await fetch(facebookUrl);
    const html = await response.text();
    
    // Look for video URLs in Facebook's page source
    const videoRegex = /"playable_url":"([^"]+)"/g;
    const matches = [];
    let match;
    
    while ((match = videoRegex.exec(html)) !== null) {
        const url = match[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/');
        matches.push({
            url: url,
            quality: 'Original',
            type: 'Facebook Direct'
        });
    }
    
    if (matches.length === 0) {
        throw new Error('No video links found in Facebook page');
    }
    
    return matches;
}

function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function displayResults(urls, originalUrl) {
    const resultDiv = document.getElementById('result');
    
    if (urls.length === 0) {
        showError('No direct video links found');
        return;
    }
    
    let html = `<div class="success-message">
        <h3>✅ Found ${urls.length} direct link(s)</h3>
        <p><strong>Original URL:</strong> ${originalUrl}</p>
    </div>`;
    
    urls.forEach((link, index) => {
        html += `
        <div class="download-link">
            <div class="link-info">
                <strong>Quality:</strong> ${link.quality} | 
                <strong>Type:</strong> ${link.type}
            </div>
            <div class="url-container">
                <input type="text" value="${link.url}" readonly class="url-input">
                <button onclick="copyUrl(${index})" class="copy-btn">Copy</button>
                <a href="${link.url}" target="_blank" download class="download-btn">Download</a>
            </div>
        </div>`;
    });
    
    // Store URLs for copying
    window.currentUrls = urls;
    
    resultDiv.innerHTML = html;
}

function copyUrl(index) {
    const url = window.currentUrls[index].url;
    navigator.clipboard.writeText(url).then(() => {
        alert('URL copied to clipboard!');
    });
}

function showError(message) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `<div class="error-message">❌ ${message}</div>`;
}

// Enter key support
document.getElementById('videoUrl').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') extractVideoLinks();
});

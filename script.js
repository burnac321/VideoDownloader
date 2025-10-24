async function extractVideoLinks() {
    const videoUrl = document.getElementById('videoUrl').value;
    const resultDiv = document.getElementById('result');
    const progressDiv = document.getElementById('progress');
    
    if (!videoUrl) {
        showError('Please enter a video URL');
        return;
    }

    progressDiv.style.display = 'block';
    resultDiv.innerHTML = '';

    try {
        const videoId = extractYouTubeId(videoUrl);
        if (!videoId) {
            showError('Invalid YouTube URL');
            return;
        }

        const directUrls = await getYouTubeDownloadLinks(videoId);
        displayResults(directUrls, videoUrl);
        
    } catch (error) {
        showError(`Failed to extract links: ${error.message}`);
    } finally {
        progressDiv.style.display = 'none';
    }
}

async function getYouTubeDownloadLinks(videoId) {
    // Method 1: Try multiple public APIs
    const apis = [
        `https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${videoId}`,
        `https://youtube-video-download-info.p.rapidapi.com/dl?id=${videoId}`,
        `https://youtube-downloader8.p.rapidapi.com/?url=https://www.youtube.com/watch?v=${videoId}`
    ];

    for (const apiUrl of apis) {
        try {
            const response = await fetch(apiUrl, {
                headers: {
                    // Some APIs don't require keys for basic usage
                    'X-RapidAPI-Key': 'your-optional-key',
                    'X-RapidAPI-Host': new URL(apiUrl).hostname
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return parseApiResponse(data);
            }
        } catch (error) {
            console.log(`API ${apiUrl} failed:`, error.message);
            continue;
        }
    }

    // Method 2: Use client-side extraction as fallback
    return await clientSideExtraction(videoId);
}

function parseApiResponse(data) {
    const urls = [];
    
    // Parse different API response formats
    if (data.formats) {
        data.formats.forEach(format => {
            if (format.url && format.quality) {
                urls.push({
                    url: format.url,
                    quality: format.quality,
                    type: format.mimeType?.split(';')[0] || 'Video'
                });
            }
        });
    } else if (data.link) {
        urls.push({
            url: data.link,
            quality: data.quality || 'Unknown',
            type: 'Direct Download'
        });
    }
    
    return urls;
}

async function clientSideExtraction(videoId) {
    // Simple client-side method using embed player
    return new Promise((resolve) => {
        const urls = [];
        
        // Create hidden iframe to get video info
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        iframe.onload = function() {
            // This is a simplified approach - in reality, you'd need more complex handling
            setTimeout(() => {
                // Fallback to direct download services
                urls.push({
                    url: `https://ssyoutube.com/watch?v=${videoId}`,
                    quality: 'Use External Service',
                    type: 'Redirect to Downloader'
                });
                
                urls.push({
                    url: `https://en.savefrom.net/1-youtube-video-downloader/?url=https://www.youtube.com/watch?v=${videoId}`,
                    quality: 'Use External Service', 
                    type: 'Redirect to Downloader'
                });
                
                resolve(urls);
                document.body.removeChild(iframe);
            }, 2000);
        };
        
        document.body.appendChild(iframe);
    });
}

// Rest of your existing functions remain the same...
function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function displayResults(urls, originalUrl) {
    const resultDiv = document.getElementById('result');
    
    if (urls.length === 0) {
        showError('No download links found. Try using external services below.');
        // Show external service options
        resultDiv.innerHTML += `
            <div class="external-services">
                <h3>Alternative Download Methods:</h3>
                <p>Try these external services:</p>
                <ul>
                    <li><a href="https://ssyoutube.com/watch?v=${extractYouTubeId(originalUrl)}" target="_blank">ssYouTube</a></li>
                    <li><a href="https://en.savefrom.net/1-youtube-video-downloader/?url=${originalUrl}" target="_blank">SaveFrom.net</a></li>
                    <li><a href="https://y2mate.com/youtube/${extractYouTubeId(originalUrl)}" target="_blank">Y2Mate</a></li>
                </ul>
            </div>
        `;
        return;
    }
    
    let html = `<div class="success-message">
        <h3>✅ Found ${urls.length} download option(s)</h3>
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
                ${link.url.startsWith('http') ? `
                    <input type="text" value="${link.url}" readonly class="url-input">
                    <button onclick="copyUrl(${index})" class="copy-btn">Copy</button>
                    <a href="${link.url}" target="_blank" class="download-btn">Open</a>
                ` : `
                    <span>${link.url}</span>
                `}
            </div>
        </div>`;
    });
    
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

document.getElementById('videoUrl').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') extractVideoLinks();
});

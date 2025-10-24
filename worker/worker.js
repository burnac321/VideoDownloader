// Main worker using Pyodide to run yt-dlp
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve frontend
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return serveFrontend();
    }

    // API routes
    if (url.pathname === '/api/info') {
      return handleVideoInfo(request, env, ctx);
    }

    if (url.pathname === '/api/download') {
      return handleDownload(request, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleVideoInfo(request, env, ctx) {
  try {
    const { url: videoUrl } = await request.json();
    
    if (!videoUrl) {
      return jsonResponse({ error: 'URL is required' }, 400);
    }

    // Load Pyodide and run yt-dlp
    const videoInfo = await getVideoInfoWithYtDlp(videoUrl);
    return jsonResponse(videoInfo);
    
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleDownload(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const videoUrl = url.searchParams.get('url');
    const format = url.searchParams.get('format') || 'best';
    
    if (!videoUrl) {
      return jsonResponse({ error: 'URL is required' }, 400);
    }

    // Get direct download URL using yt-dlp
    const downloadInfo = await getDownloadUrlWithYtDlp(videoUrl, format);
    
    if (downloadInfo.direct_url) {
      // Redirect to the direct download URL
      return Response.redirect(downloadInfo.direct_url, 302);
    } else {
      // Return the download info
      return jsonResponse(downloadInfo);
    }
    
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// Core yt-dlp implementation using Pyodide
async function getVideoInfoWithYtDlp(videoUrl) {
  // This would be implemented with Pyodide
  // For now, using a workaround with service binding
  return await runYtDlpScript('get_info', videoUrl);
}

async function getDownloadUrlWithYtDlp(videoUrl, format) {
  return await runYtDlpScript('get_download_url', videoUrl, format);
}

// Pyodide implementation
async function runYtDlpScript(operation, videoUrl, format = null) {
  // Load Pyodide
  const pyodide = await loadPyodide();
  
  // Install yt-dlp
  await pyodide.runPythonAsync(`
    import micropip
    await micropip.install('yt-dlp')
  `);
  
  // Run the appropriate operation
  if (operation === 'get_info') {
    return await pyodide.runPythonAsync(`
      import yt_dlp
      import json
      
      ydl_opts = {
          'quiet': True,
          'no_warnings': True,
      }
      
      with yt_dlp.YoutubeDL(ydl_opts) as ydl:
          info = ydl.extract_info('${videoUrl}', download=False)
          result = {
              'title': info.get('title', 'Unknown'),
              'duration': info.get('duration_string', 'Unknown'),
              'uploader': info.get('uploader', 'Unknown'),
              'thumbnail': info.get('thumbnail', ''),
              'formats': []
          }
          
          # Extract available formats
          for fmt in info.get('formats', []):
              if fmt.get('filesize') or fmt.get('format_note'):
                  result['formats'].append({
                      'format_id': fmt.get('format_id'),
                      'ext': fmt.get('ext'),
                      'quality': fmt.get('format_note', 'Unknown'),
                      'filesize': fmt.get('filesize'),
                      'format': fmt.get('format')
                  })
          
          json.dumps(result)
    `);
  } else if (operation === 'get_download_url') {
    return await pyodide.runPythonAsync(`
      import yt_dlp
      import json
      
      ydl_opts = {
          'quiet': True,
          'no_warnings': True,
          'format': '${format}',
      }
      
      with yt_dlp.YoutubeDL(ydl_opts) as ydl:
          info = ydl.extract_info('${videoUrl}', download=False)
          result = {
              'url': info.get('url'),
              'title': info.get('title'),
              'ext': info.get('ext'),
              'direct_url': info.get('url')
          }
          json.dumps(result)
    `);
  }
}

// Alternative: Using a Python Worker with yt-dlp
async function runYtDlpPython(code) {
  // This would execute in a Python runtime
  const response = await fetch('https://python-worker.your-domain.com/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  
  return await response.json();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function serveFrontend() {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>YouTube Video Downloader </title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
      .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      h1 { color: #333; margin-bottom: 10px; text-align: center; }
      .input-section { display: flex; gap: 10px; margin: 20px 0; }
      input { flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; }
      button { padding: 12px 24px; background: #ff0000; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
      button:hover { background: #cc0000; }
      button:disabled { background: #ccc; cursor: not-allowed; }
      .loading { text-align: center; padding: 20px; }
      .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #ff0000; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .error { background: #fee; color: #c00; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #c00; }
      .video-info { display: flex; gap: 20px; margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; }
      .thumbnail { width: 160px; height: 90px; border-radius: 6px; object-fit: cover; }
      .video-details h3 { margin-bottom: 10px; color: #333; }
      .video-details p { color: #666; margin-bottom: 5px; }
      .formats { margin-top: 20px; }
      .format { display: flex; justify-content: space-between; align-items: center; padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #ff0000; }
      .format-info { flex: 1; }
      .download-btn { background: #28a745; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; }
      .download-btn:hover { background: #218838; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>YouTube Video Downloader</h1>
      <p style="text-align: center; color: #666; margin-bottom: 30px;">Powered by yt-dlp - No external APIs</p>
      
      <div class="input-section">
        <input type="url" id="videoUrl" placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=...)" required>
        <button onclick="getVideoInfo()" id="fetchBtn">Get Formats</button>
      </div>

      <div id="loading" class="loading" style="display: none;">
        <div class="spinner"></div>
        <p>Fetching video information with yt-dlp...</p>
      </div>

      <div id="error" class="error" style="display: none;"></div>

      <div id="results" style="display: none;">
        <div class="video-info">
          <img id="thumbnail" class="thumbnail" src="" alt="Thumbnail">
          <div class="video-details">
            <h3 id="videoTitle"></h3>
            <p id="videoDuration"></p>
            <p id="videoAuthor"></p>
          </div>
        </div>

        <div class="formats">
          <h3>Available Formats:</h3>
          <div id="formatsList"></div>
        </div>
      </div>
    </div>

    <script>
      async function getVideoInfo() {
        const url = document.getElementById('videoUrl').value.trim();
        const fetchBtn = document.getElementById('fetchBtn');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const results = document.getElementById('results');
        
        if (!url) {
          showError('Please enter a YouTube URL');
          return;
        }

        if (!isValidYouTubeUrl(url)) {
          showError('Please enter a valid YouTube URL');
          return;
        }

        showLoading();
        hideError();
        hideResults();

        try {
          const response = await fetch('/api/info', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch video information');
          }

          displayResults(data);
        } catch (error) {
          showError(error.message);
        } finally {
          hideLoading();
        }
      }

      function isValidYouTubeUrl(url) {
        const patterns = [
          /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
        ];
        return patterns.some(pattern => pattern.test(url));
      }

      function displayResults(data) {
        document.getElementById('thumbnail').src = data.thumbnail;
        document.getElementById('videoTitle').textContent = data.title;
        document.getElementById('videoDuration').textContent = 'Duration: ' + data.duration;
        document.getElementById('videoAuthor').textContent = 'Channel: ' + data.uploader;

        const formatsList = document.getElementById('formatsList');
        formatsList.innerHTML = '';

        if (data.formats && data.formats.length > 0) {
          data.formats.forEach(format => {
            const formatDiv = document.createElement('div');
            formatDiv.className = 'format';
            
            const formatInfo = document.createElement('div');
            formatInfo.className = 'format-info';
            formatInfo.innerHTML = \`
              <strong>\${format.quality || format.format_id}</strong>
              <span> • \${format.ext} • \${format.filesize ? formatFileSize(format.filesize) : 'Unknown size'}</span>
            \`;
            
            const downloadBtn = document.createElement('a');
            downloadBtn.href = \`/api/download?url=\${encodeURIComponent(document.getElementById('videoUrl').value)}&format=\${format.format_id}\`;
            downloadBtn.className = 'download-btn';
            downloadBtn.textContent = 'Download';
            downloadBtn.target = '_blank';
            
            formatDiv.appendChild(formatInfo);
            formatDiv.appendChild(downloadBtn);
            formatsList.appendChild(formatDiv);
          });
        } else {
          formatsList.innerHTML = '<p>No formats available</p>';
        }

        showResults();
      }

      function formatFileSize(bytes) {
        if (!bytes) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
      }

      function showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('fetchBtn').disabled = true;
      }

      function hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('fetchBtn').disabled = false;
      }

      function showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
      }

      function hideError() {
        document.getElementById('error').style.display = 'none';
      }

      function showResults() {
        document.getElementById('results').style.display = 'block';
      }

      function hideResults() {
        document.getElementById('results').style.display = 'none';
      }

      // Enter key support
      document.getElementById('videoUrl').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          getVideoInfo();
        }
      });
    </script>
  </body>
  </html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

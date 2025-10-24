from flask import Flask, request, send_file, jsonify
from yt_dlp import YoutubeDL
from flask_cors import CORS
import tempfile, os, logging

app = Flask(__name__)
CORS(app)

# Set up logging
logging.basicConfig(level=logging.DEBUG)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Y2MATEZ backend is running 🚀"})

@app.route("/download", methods=["POST"])
def download_video():
    data = request.get_json()
    url = data.get("url")
    format_type = data.get("format", "video")

    if not url:
        return jsonify({"error": "Missing video URL"}), 400

    temp_dir = tempfile.mkdtemp()
    ydl_opts = {
        "outtmpl": f"{temp_dir}/%(title)s.%(ext)s",
        "quiet": False,  # Changed to False to see logs
        "noplaylist": True,
        "restrictfilenames": True
    }

    # SIMPLIFIED FORMAT SELECTION - Remove FFmpeg dependency
    if format_type == "audio":
        ydl_opts["format"] = "bestaudio/best"
        # REMOVED FFmpeg postprocessor - use native format
    else:
        ydl_opts["format"] = "best[height<=720]"  # Limit to 720p to reduce memory

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            downloaded_file = ydl.prepare_filename(info)
            
            # Handle possible file extension changes
            if format_type == "audio" and os.path.exists(downloaded_file.replace('.webm', '.mp3')):
                downloaded_file = downloaded_file.replace('.webm', '.mp3')
            elif format_type == "audio" and os.path.exists(downloaded_file.replace('.m4a', '.mp3')):
                downloaded_file = downloaded_file.replace('.m4a', '.mp3')
            
            if not os.path.exists(downloaded_file):
                # Find the actual downloaded file
                files = os.listdir(temp_dir)
                if files:
                    downloaded_file = os.path.join(temp_dir, files[0])
                else:
                    return jsonify({"error": "No file was downloaded"}), 500

            # Get safe filename for download
            safe_filename = os.path.basename(downloaded_file)
            
            return send_file(
                downloaded_file,
                as_attachment=True,
                download_name=safe_filename
            )
            
    except Exception as e:
        logging.error(f"Download error: {str(e)}")
        return jsonify({"error": f"Download failed: {str(e)}"}), 500
        
    finally:
        # Cleanup
        try:
            for f in os.listdir(temp_dir):
                os.remove(os.path.join(temp_dir, f))
            os.rmdir(temp_dir)
        except Exception as e:
            logging.error(f"Cleanup error: {e}")

@app.route("/debug", methods=["POST"])
def debug_download():
    """Debug endpoint to test without actual download"""
    data = request.get_json()
    url = data.get("url")
    
    if not url:
        return jsonify({"error": "Missing URL"}), 400
        
    ydl_opts = {
        "quiet": False,
        "extract_flat": True  # Don't download, just get info
    }
    
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return jsonify({
                "status": "success",
                "title": info.get('title'),
                "duration": info.get('duration'),
                "formats": len(info.get('formats', [])),
                "thumbnail": info.get('thumbnail')
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000, debug=True)

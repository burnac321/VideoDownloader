from flask import Flask, request, send_file, jsonify
from yt_dlp import YoutubeDL
from flask_cors import CORS
import tempfile, os

app = Flask(__name__)
CORS(app)

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
        "quiet": True,
        "noplaylist": True,
        "restrictfilenames": True
    }

    if format_type == "audio":
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }]
    else:
        ydl_opts["format"] = "best"

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file_path = ydl.prepare_filename(info)
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        for f in os.listdir(temp_dir):
            os.remove(os.path.join(temp_dir, f))
        os.rmdir(temp_dir)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)

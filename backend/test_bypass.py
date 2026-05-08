import yt_dlp
import sys

url = "https://www.youtube.com/watch?v=iFaaCxTPEI8"
ydl_opts = {
    'format': 'bestvideo+bestaudio/best', 
    'quiet': True, 
    'noplaylist': True,
    'nocheckcertificate': True,
    'extractor_args': {'youtube': {'player_client': ['ios', 'mweb', 'android', 'web']}}
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        print(f"SUCCESS: {info.get('title')}")
except Exception as e:
    print(f"FAILED: {e}")
    # sys.exit(1) # Don't exit so we can see output

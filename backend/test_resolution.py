import yt_dlp
import json

ydl_opts = {
    'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', 
    'quiet': True,
    'extractor_args': {'youtube': {'player_client': ['ios', 'android', 'web']}}
}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info("https://youtu.be/fhLcI-3xE3s", download=False)
    
video_streams = [f for f in info.get('formats', []) if f.get('vcodec') != 'none' and f.get('ext') == 'mp4']
if video_streams:
    best_video = max(video_streams, key=lambda x: x.get('height', 0))
    print(f"BEST VIDEO: {best_video.get('format_id')} - {best_video.get('resolution')} - {best_video.get('vbr')}k - {best_video.get('url')[:100]}")
    
# Let's also check requested_formats
if 'requested_formats' in info:
    req = info['requested_formats'][0]
    print(f"REQ VIDEO: {req.get('format_id')} - {req.get('resolution')} - {req.get('vbr')}k")

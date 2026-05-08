import yt_dlp
import subprocess

ydl_opts = {
    'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', 
    'quiet': True,
}
print("Extracting info...")
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info("https://youtu.be/fhLcI-3xE3s", download=False)
    
if 'requested_formats' in info:
    video_url = info['requested_formats'][0]['url']
    audio_url = info['requested_formats'][1]['url']
    print("Running ffmpeg...")
    command = [
        "ffmpeg",
        "-ss", "0",
        "-t", "5",
        "-i", video_url,
        "-ss", "0",
        "-t", "5",
        "-i", audio_url,
        "-vf", "crop=100:100:0:0",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-c:a", "aac",
        "-strict", "experimental",
        "test_output.mp4",
        "-y"
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        print("FFMPEG ERROR:")
        print(result.stderr)
    else:
        print("SUCCESS")
else:
    print("NO REQUESTED FORMATS")

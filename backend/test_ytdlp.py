import yt_dlp

ydl_opts = {
    'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', 
    'quiet': True,
}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info("https://youtu.be/fhLcI-3xE3s", download=False)
    if 'requested_formats' in info:
        print("VIDEO:", info['requested_formats'][0]['url'][:100])
        print("AUDIO:", info['requested_formats'][1]['url'][:100])
        print("V_RES:", info['requested_formats'][0].get('resolution'))
    else:
        print("COMBINED:", info['url'][:100])

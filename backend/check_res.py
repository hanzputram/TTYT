import yt_dlp
ydl_opts = {'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', 'quiet': True}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info("https://youtu.be/fhLcI-3xE3s", download=False)
    w = info.get('width')
    h = info.get('height')
    print(f"Top-level w/h: {w}x{h}")
    if 'requested_formats' in info:
        rw = info['requested_formats'][0].get('width')
        rh = info['requested_formats'][0].get('height')
        print(f"Requested w/h: {rw}x{rh}")
    else:
        print("No requested formats")

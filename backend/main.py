import os
import subprocess
import uuid
import json
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import yt_dlp
import re

app = FastAPI()

# Store progress in memory
progress_store = {}

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = "downloads"
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

app.mount("/downloads", StaticFiles(directory=DOWNLOAD_DIR), name="downloads")

class ProcessRequest(BaseModel):
    url: str
    start_time: float
    end_time: float
    crop_x: float  # Percentage 0-1
    crop_y: float  # Percentage 0-1
    crop_w: float  # Percentage 0-1
    crop_h: float  # Percentage 0-1

class ClipItem(BaseModel):
    start_time: float
    end_time: float

class BatchProcessRequest(BaseModel):
    url: str
    clips: list[ClipItem]
    crop_x: float
    crop_y: float
    crop_w: float
    crop_h: float

def strip_ansi(text):
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

@app.get("/info")
def get_video_info(url: str):
    ydl_opts = {
        'format': 'bestvideo+bestaudio/best', 
        'quiet': True, 
        'noplaylist': True,
        'nocheckcertificate': True,
        'extractor_args': {'youtube': {'player_client': ['ios', 'mweb', 'android', 'web']}}
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            
            best_video = None
            best_audio = None
            
            if 'requested_formats' in info:
                best_video = info['requested_formats'][0]
                best_audio = info['requested_formats'][1]
            else:
                video_streams = [f for f in info.get('formats', []) if f.get('vcodec') != 'none' and f.get('height')]
                if video_streams:
                    best_video = max(video_streams, key=lambda x: x.get('height', 0))
                audio_streams = [f for f in info.get('formats', []) if f.get('acodec') != 'none']
                if audio_streams:
                    best_audio = max(audio_streams, key=lambda x: x.get('abr') or 0)
                
            video_url = best_video['url'] if best_video else info.get('url')
            audio_url = best_audio['url'] if best_audio else None
                
            return {
                "title": info.get('title'),
                "thumbnail": info.get('thumbnail'),
                "duration": info.get('duration'),
                "video_url": video_url,
                "audio_url": audio_url,
                "formats": [{"url": video_url}]
            }
        except Exception as e:
            error_msg = strip_ansi(str(e))
            if "DRM protected" in error_msg:
                error_msg = "This video is DRM protected (e.g. a movie or official music video) and cannot be processed for clipping."
            elif "age-restricted" in error_msg.lower():
                error_msg = "This video is age-restricted and requires authentication. Please try a public video."
            
            raise HTTPException(status_code=400, detail=error_msg)

def run_render_task(job_id: str, req: ProcessRequest, output_filename: str, output_path: str):
    try:
        progress_store[job_id] = {"progress": 2, "status": "Connecting to High-Speed Stream..."}
        
        ydl_opts = {
            'format': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best', 
            'quiet': True,
            'noplaylist': True,
            'nocheckcertificate': True,
            'extractor_args': {'youtube': {'player_client': ['ios', 'mweb', 'android', 'web']}}
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)

        width = info.get('width', 1920)
        height = info.get('height', 1080)
        
        if 'requested_formats' in info:
            best_video = info['requested_formats'][0]
            best_audio = info['requested_formats'][1]
        else:
            video_streams = [f for f in info.get('formats', []) if f.get('vcodec') != 'none' and f.get('height')]
            best_video = max(video_streams, key=lambda x: x.get('height', 0)) if video_streams else info
            audio_streams = [f for f in info.get('formats', []) if f.get('acodec') != 'none']
            best_audio = max(audio_streams, key=lambda x: x.get('abr') or 0) if audio_streams else None

        # High-speed UA
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

        if best_audio:
            video_url = best_video['url']
            audio_url = best_audio['url']
            width = best_video.get('width', width)
            height = best_video.get('height', height)
            
            cw = int(req.crop_w * width)
            ch = int(req.crop_h * height)
            cx = int(req.crop_x * width)
            cy = int(req.crop_y * height)
            
            cw = cw if cw % 2 == 0 else cw - 1
            ch = ch if ch % 2 == 0 else ch - 1

            command = [
                "ffmpeg",
                "-user_agent", ua,
                "-reconnect", "1", "-reconnect_at_eof", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
                "-ss", str(req.start_time),
                "-t", str(req.end_time - req.start_time),
                "-i", video_url,
                "-user_agent", ua,
                "-reconnect", "1", "-reconnect_at_eof", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
                "-ss", str(req.start_time),
                "-t", str(req.end_time - req.start_time),
                "-i", audio_url,
                "-vf", f"crop={cw}:{ch}:{cx}:{cy}",
                "-c:v", "libx264",
                "-crf", "20",
                "-preset", "superfast",
                "-c:a", "aac",
                "-b:a", "192k",
                "-strict", "experimental",
                output_path,
                "-y"
            ]
        else:
            video_url = info['url']
            cw = int(req.crop_w * width)
            ch = int(req.crop_h * height)
            cx = int(req.crop_x * width)
            cy = int(req.crop_y * height)
            cw = cw if cw % 2 == 0 else cw - 1
            ch = ch if ch % 2 == 0 else ch - 1
            
            command = [
                "ffmpeg",
                "-user_agent", ua,
                "-reconnect", "1", "-reconnect_at_eof", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
                "-ss", str(req.start_time),
                "-t", str(req.end_time - req.start_time),
                "-i", video_url,
                "-vf", f"crop={cw}:{ch}:{cx}:{cy}",
                "-c:v", "libx264",
                "-crf", "20",
                "-preset", "superfast",
                "-c:a", "aac",
                "-b:a", "192k",
                "-strict", "experimental",
                output_path,
                "-y"
            ]

        total_duration = req.end_time - req.start_time
        progress_store[job_id] = {"progress": 5, "status": "Starting Render (4K takes time)..."}
        
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            encoding='utf-8',
            errors='replace'
        )

        time_pattern = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")
        
        last_line = ""
        for line in process.stdout:
            last_line = line.strip()
            match = time_pattern.search(line)
            if match:
                hours, minutes, seconds = map(float, match.groups())
                current_time = hours * 3600 + minutes * 60 + seconds
                progress = min(99, int((current_time / total_duration) * 95) + 5)
                progress_store[job_id] = {"progress": progress, "status": f"Rendering ({progress}%)..."}

        process.wait()
        if process.returncode != 0:
            error_details = strip_ansi(last_line)
            progress_store[job_id] = {"progress": -1, "status": f"FFmpeg Error: {error_details}"}
            return
            
        progress_store[job_id] = {
            "progress": 100, 
            "status": "Complete!", 
            "download_url": f"http://localhost:8001/api/download/{output_filename}"
        }
    except Exception as e:
        error_msg = strip_ansi(str(e))
        if "DRM protected" in error_msg:
            error_msg = "This video is DRM protected and cannot be processed."
        elif "age-restricted" in error_msg.lower():
            error_msg = "This video is age-restricted and requires authentication."
            
        print(f"Background task error: {error_msg}")
        progress_store[job_id] = {"progress": -1, "status": f"Error: {error_msg}"}

@app.post("/process")
async def process_video(req: ProcessRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    output_filename = f"{job_id}.mp4"
    output_path = os.path.join(DOWNLOAD_DIR, output_filename)
    
    progress_store[job_id] = {"progress": 0, "status": "Initializing job..."}
    background_tasks.add_task(run_render_task, job_id, req, output_filename, output_path)
    
    return {"job_id": job_id}

def run_batch_render(batch_id: str, req: BatchProcessRequest):
    total_clips = len(req.clips)
    download_urls = []
    try:
        for idx, clip in enumerate(req.clips):
            clip_label = f"Clip {idx+1}/{total_clips}"
            progress_store[batch_id] = {
                "progress": int((idx / total_clips) * 100),
                "status": f"{clip_label}: Connecting...",
                "current_clip": idx + 1,
                "total_clips": total_clips,
                "download_urls": download_urls
            }

            single_req = ProcessRequest(
                url=req.url,
                start_time=clip.start_time,
                end_time=clip.end_time,
                crop_x=req.crop_x,
                crop_y=req.crop_y,
                crop_w=req.crop_w,
                crop_h=req.crop_h
            )

            clip_id = f"{batch_id}_clip{idx}"
            clip_filename = f"{clip_id}.mp4"
            clip_path = os.path.join(DOWNLOAD_DIR, clip_filename)

            progress_store[clip_id] = {"progress": 0, "status": "Starting..."}
            run_render_task(clip_id, single_req, clip_filename, clip_path)

            clip_state = progress_store.get(clip_id, {})
            if clip_state.get("progress", -1) == -1:
                progress_store[batch_id] = {
                    "progress": -1,
                    "status": f"{clip_label} failed: {clip_state.get('status', 'Unknown error')}",
                    "download_urls": download_urls
                }
                return

            download_urls.append(f"http://localhost:8001/api/download/{clip_filename}")

        progress_store[batch_id] = {
            "progress": 100,
            "status": f"All {total_clips} clips complete!",
            "current_clip": total_clips,
            "total_clips": total_clips,
            "download_urls": download_urls
        }
    except Exception as e:
        progress_store[batch_id] = {
            "progress": -1,
            "status": f"Batch error: {strip_ansi(str(e))}",
            "download_urls": download_urls
        }

@app.post("/process-batch")
async def process_batch(req: BatchProcessRequest, background_tasks: BackgroundTasks):
    batch_id = str(uuid.uuid4())
    progress_store[batch_id] = {"progress": 0, "status": "Initializing batch...", "total_clips": len(req.clips)}
    background_tasks.add_task(run_batch_render, batch_id, req)
    return {"batch_id": batch_id, "total_clips": len(req.clips)}

@app.get("/api/progress/{job_id}")
def get_progress(job_id: str):
    state = progress_store.get(job_id, {"progress": 0, "status": "Job not found"})
    return state

@app.get("/api/download/{filename}")
async def download_video_file(filename: str):
    file_path = os.path.join(DOWNLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=file_path, 
        media_type='application/octet-stream',
        filename=f"TrimTube_{filename}"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

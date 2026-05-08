import React, { useState, useRef, useEffect } from 'react';
import { Download, Scissors, Crop, Loader2, Sparkles, Video, Settings2, Play, Pause, Plus, Trash2, Layers } from 'lucide-react';

const API_BASE = "http://localhost:8001";

function App() {
  const [url, setUrl] = useState('');
  const [playableUrl, setPlayableUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const [activeClipIndex, setActiveClipIndex] = useState(0);

  // Multi-clip state
  const [clips, setClips] = useState([{ id: 1, startTime: 0, endTime: 0, startInput: "00:00", endInput: "00:00" }]);
  
  // Free crop state (shared across clips)
  const [crop, setCrop] = useState({ x: 0.25, y: 0.1, w: 0.5, h: 0.8 });
  const previewRef = useRef(null);
  const playerRef = useRef(null);
  const audioRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch video info");
      
      setVideoInfo(data);
      setDuration(data.duration);
      setClips([{ id: 1, startTime: 0, endTime: data.duration, startInput: "00:00", endInput: formatTime(data.duration) }]);
      setActiveClipIndex(0);
      
      if (data.video_url) {
        setVideoUrl(data.video_url);
        setAudioUrl(data.audio_url);
      } else if (data.formats && data.formats.length > 0) {
        setPlayableUrl(data.formats[0].url);
      } else {
        setPlayableUrl(url);
      }
    } catch (e) {
      setError(e.message || "Failed to fetch video info.");
      setVideoInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const addClip = () => {
    const newId = Math.max(...clips.map(c => c.id)) + 1;
    setClips(prev => [...prev, { id: newId, startTime: 0, endTime: duration, startInput: "00:00", endInput: formatTime(duration) }]);
    setActiveClipIndex(clips.length);
  };

  const removeClip = (index) => {
    if (clips.length <= 1) return;
    setClips(prev => prev.filter((_, i) => i !== index));
    if (activeClipIndex >= clips.length - 1) setActiveClipIndex(Math.max(0, clips.length - 2));
    else if (activeClipIndex > index) setActiveClipIndex(activeClipIndex - 1);
  };

  const updateClip = (index, field, value) => {
    setClips(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleBatchExport = async () => {
    setProcessing(true);
    setError('');
    setProgress(0);
    try {
      const res = await fetch(`${API_BASE}/process-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          clips: clips.map(c => ({ start_time: c.startTime, end_time: c.endTime })),
          crop_x: crop.x, crop_y: crop.y, crop_w: crop.w, crop_h: crop.h
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Batch processing failed");

      const batchId = data.batch_id;
      const pollProgress = setInterval(async () => {
        try {
          const pRes = await fetch(`${API_BASE}/api/progress/${batchId}`);
          const pData = await pRes.json();
          if (pData.progress === -1) {
            clearInterval(pollProgress);
            setError(`Batch Error: ${pData.status}`);
            setProcessing(false);
          } else {
            setProgress(pData.progress);
            setStatusText(pData.status);
            if (pData.progress >= 100 && pData.download_urls) {
              clearInterval(pollProgress);
              for (const dlUrl of pData.download_urls) {
                await triggerFileDownload(dlUrl);
                await new Promise(r => setTimeout(r, 500));
              }
              setProcessing(false);
            }
          }
        } catch (e) { console.error("Polling error", e); }
      }, 1000);
    } catch (e) {
      setError("Failed to start batch. Check backend connection.");
      setProcessing(false);
    }
  };

  const triggerFileDownload = async (downloadUrl) => {
    try {
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) throw new Error('Download failed');
      const blob = await fileRes.blob();
      const localUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = `TrimTube_${Math.floor(Date.now() / 1000)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(localUrl);
    } catch (err) {
      window.open(downloadUrl, '_blank');
    }
  };

  const onMouseMove = (e) => {
    if (!isDragging || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    let newX = (e.clientX - rect.left) / rect.width - crop.w / 2;
    let newY = (e.clientY - rect.top) / rect.height - crop.h / 2;
    if (newX < 0) newX = 0;
    if (newX + crop.w > 1) newX = 1 - crop.w;
    if (newY < 0) newY = 0;
    if (newY + crop.h > 1) newY = 1 - crop.h;
    setCrop(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleWidthChange = (e) => {
    let newW = Number(e.target.value);
    let newX = crop.x;
    if (newX + newW > 1) newX = 1 - newW;
    setCrop(prev => ({ ...prev, x: newX, w: newW }));
  };

  const handleHeightChange = (e) => {
    let newH = Number(e.target.value);
    let newY = crop.y;
    if (newY + newH > 1) newY = 1 - newH;
    setCrop(prev => ({ ...prev, y: newY, h: newH }));
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const parseTime = (timeStr) => {
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return NaN;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return NaN;
  };

  const handleClipStartBlur = (index) => {
    const clip = clips[index];
    let sec = parseTime(clip.startInput);
    if (!isNaN(sec) && sec < clip.endTime) {
      updateClip(index, 'startTime', sec);
      updateClip(index, 'startInput', formatTime(sec));
      if (index === activeClipIndex && playerRef.current) playerRef.current.currentTime = sec;
    } else {
      updateClip(index, 'startInput', formatTime(clip.startTime));
    }
  };

  const handleClipEndBlur = (index) => {
    const clip = clips[index];
    let sec = parseTime(clip.endInput);
    if (!isNaN(sec) && sec > clip.startTime) {
      if (sec > duration) sec = duration;
      updateClip(index, 'endTime', sec);
      updateClip(index, 'endInput', formatTime(sec));
    } else {
      updateClip(index, 'endInput', formatTime(clip.endTime));
    }
  };

  const handleClipStartSlider = (index, val) => {
    if (val >= clips[index].endTime) return;
    updateClip(index, 'startTime', val);
    updateClip(index, 'startInput', formatTime(val));
    if (index === activeClipIndex && playerRef.current) playerRef.current.currentTime = val;
  };

  const handleClipEndSlider = (index, val) => {
    if (val <= clips[index].startTime) return;
    updateClip(index, 'endTime', val);
    updateClip(index, 'endInput', formatTime(val));
  };

  const handleProgress = () => {
    if (!playerRef.current || !clips[activeClipIndex]) return;
    const currentTime = playerRef.current.currentTime;
    if (currentTime > clips[activeClipIndex].endTime) {
      playerRef.current.currentTime = clips[activeClipIndex].startTime;
      playerRef.current.pause();
      setPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      setPlaying(false);
    } else {
      if (audioRef.current) audioRef.current.currentTime = playerRef.current.currentTime;
      playerRef.current.play().then(() => {
        setPlaying(true);
        if (audioRef.current) audioRef.current.play().catch(() => {});
      }).catch(() => setPlaying(false));
    }
  };

  const selectClip = (index) => {
    setActiveClipIndex(index);
    if (playerRef.current) playerRef.current.currentTime = clips[index].startTime;
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging]);

  const totalClipDuration = clips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);

  return (
    <div className="app-container">
      <div className="glow-orb orb-1"></div>
      <div className="glow-orb orb-2"></div>
      
      <header>
        <div className="logo">
          <div className="logo-icon-wrapper">
            <Sparkles className="logo-icon" size={20} />
          </div>
          Trim<span className="gradient-text">Tube</span>
        </div>
        <div className="status-badge">
          <span className="dot"></span> Local Engine Active
        </div>
      </header>

      <main>
        <div className="hero-section">
          <h1 className="hero-title">Create Viral Shorts in <span className="gradient-text">Seconds</span></h1>
          <p className="hero-subtitle">Paste any YouTube link, add multiple clips, and batch export perfect vertical videos for TikTok and Reels.</p>
        </div>

        <div className="input-card glass-panel">
          <div className="input-wrapper">
            <Video className="input-icon" size={20} />
            <input 
              type="text" 
              placeholder="Paste YouTube URL here..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <button className="primary-btn" onClick={fetchInfo} disabled={loading || !url}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Generate Workflow'}
          </button>
        </div>

        {error && (
          <div className="error-banner glass-panel" style={{ marginTop: '20px', padding: '15px 20px', borderLeft: '4px solid #ff4d4d', background: 'rgba(255, 77, 77, 0.1)', display: 'flex', alignItems: 'center', gap: '15px', color: '#ff9999', animation: 'slideIn 0.3s ease-out' }}>
            <Settings2 size={20} style={{ color: '#ff4d4d' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', color: 'white', marginBottom: '2px' }}>Action Required</strong>
              {error}
            </div>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ff9999', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
          </div>
        )}

        {videoInfo && (
          <div className="editor-layout">
            <div className="preview-panel glass-panel">
              <div className="panel-header">
                <h3><Video size={18} /> Smart Canvas</h3>
                <span className="badge">1080p Source</span>
              </div>
              
              <div className="video-container" ref={previewRef} onMouseMove={onMouseMove} onMouseLeave={() => setIsDragging(false)}>
                <video 
                  ref={playerRef}
                  src={videoUrl || playableUrl || url} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  poster={videoInfo?.thumbnail}
                  onTimeUpdate={handleProgress}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onWaiting={() => setBuffering(true)}
                  onPlaying={() => setBuffering(false)}
                  onSeeked={() => { if (audioRef.current && playerRef.current) audioRef.current.currentTime = playerRef.current.currentTime; }}
                  playsInline
                />
                {audioUrl && <audio ref={audioRef} src={audioUrl} />}
                {isDragging && <div style={{ position: 'absolute', inset: 0, zIndex: 20 }} />}
                
                <div className="crop-mask top-mask" style={{ height: `${crop.y * 100}%`, width: '100%', top: 0, left: 0 }}></div>
                <div className="crop-mask bottom-mask" style={{ height: `${(1 - crop.y - crop.h) * 100}%`, width: '100%', bottom: 0, left: 0 }}></div>
                <div className="crop-mask left-mask" style={{ width: `${crop.x * 100}%`, top: `${crop.y * 100}%`, height: `${crop.h * 100}%` }}></div>
                <div className="crop-mask right-mask" style={{ width: `${(1 - crop.x - crop.w) * 100}%`, left: `${(crop.x + crop.w) * 100}%`, top: `${crop.y * 100}%`, height: `${crop.h * 100}%` }}></div>
                
                <div className="crop-frame active" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }} onMouseDown={() => setIsDragging(true)}>
                  <div className="frame-guidelines">
                    <div className="grid-line horizontal"></div>
                    <div className="grid-line horizontal"></div>
                    <div className="grid-line vertical"></div>
                    <div className="grid-line vertical"></div>
                  </div>
                  <div className="frame-handle top"></div>
                  <div className="frame-handle bottom"></div>
                  <div className="frame-handle left" style={{position:'absolute', top:'50%', left:'-2px', width:'4px', height:'30px', background:'white', borderRadius:'4px', transform:'translateY(-50%)', boxShadow:'0 0 10px rgba(0,0,0,0.5)'}}></div>
                  <div className="frame-handle right" style={{position:'absolute', top:'50%', right:'-2px', width:'4px', height:'30px', background:'white', borderRadius:'4px', transform:'translateY(-50%)', boxShadow:'0 0 10px rgba(0,0,0,0.5)'}}></div>
                </div>
              </div>

              <div className="player-controls">
                <button className="icon-btn" onClick={togglePlay} disabled={buffering}>
                  {buffering ? <Loader2 className="animate-spin" size={20} /> : (playing ? <Pause size={20} /> : <Play size={20} />)}
                </button>
                <div className="time-display">
                  {clips[activeClipIndex] ? formatTime(clips[activeClipIndex].startTime) : "00:00"} / {formatTime(duration)}
                </div>
                <div className="instruction-text">
                  <Sparkles size={14} className="inline-icon" /> Drag the highlighted area to frame your subject
                </div>
              </div>
            </div>

            <div className="tools-panel glass-panel">
              <div className="panel-header">
                <h3><Layers size={18} /> Clip Queue</h3>
                <span className="badge">{clips.length} clip{clips.length > 1 ? 's' : ''}</span>
              </div>

              {/* Clip List */}
              <div className="clips-list">
                {clips.map((clip, index) => (
                  <div 
                    key={clip.id} 
                    className={`clip-card ${index === activeClipIndex ? 'active' : ''}`}
                    onClick={() => selectClip(index)}
                  >
                    <div className="clip-card-header">
                      <div className="clip-number">
                        <Scissors size={14} />
                        <span>Clip {index + 1}</span>
                      </div>
                      <div className="clip-card-actions">
                        <span className="clip-duration-badge">{formatTime(clip.endTime - clip.startTime)}</span>
                        {clips.length > 1 && (
                          <button className="clip-remove-btn" onClick={(e) => { e.stopPropagation(); removeClip(index); }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {index === activeClipIndex && (
                      <div className="clip-card-body">
                        <div className="clip-time-inputs">
                          <div className="clip-time-field">
                            <label>Start</label>
                            <input 
                              type="text" 
                              value={clip.startInput}
                              onChange={(e) => updateClip(index, 'startInput', e.target.value)}
                              onBlur={() => handleClipStartBlur(index)}
                              onKeyDown={(e) => e.key === 'Enter' && handleClipStartBlur(index)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="clip-time-separator">→</div>
                          <div className="clip-time-field">
                            <label>End</label>
                            <input 
                              type="text" 
                              value={clip.endInput}
                              onChange={(e) => updateClip(index, 'endInput', e.target.value)}
                              onBlur={() => handleClipEndBlur(index)}
                              onKeyDown={(e) => e.key === 'Enter' && handleClipEndBlur(index)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="clip-sliders">
                          <input type="range" className="range-slider accent-slider" min={0} max={duration} step={0.1} value={clip.startTime}
                            onChange={(e) => handleClipStartSlider(index, Number(e.target.value))} onClick={(e) => e.stopPropagation()} />
                          <input type="range" className="range-slider accent-slider" min={0} max={duration} step={0.1} value={clip.endTime}
                            onChange={(e) => handleClipEndSlider(index, Number(e.target.value))} onClick={(e) => e.stopPropagation()} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button className="add-clip-btn" onClick={addClip}>
                  <Plus size={18} />
                  <span>Add Clip Segment</span>
                </button>
              </div>

              {/* Crop Settings */}
              <div className="settings-group">
                <div className="group-title"><Crop size={16} /> Freeform Crop Size</div>
                <div className="timeline-controls">
                  <div className="slider-container">
                    <div className="slider-labels"><span>Width</span><span>{Math.round(crop.w * 100)}%</span></div>
                    <input type="range" className="range-slider accent-slider" min={0.1} max={1} step={0.01} value={crop.w} onChange={handleWidthChange} />
                  </div>
                  <div className="slider-container mt-2">
                    <div className="slider-labels"><span>Height</span><span>{Math.round(crop.h * 100)}%</span></div>
                    <input type="range" className="range-slider accent-slider" min={0.1} max={1} step={0.01} value={crop.h} onChange={handleHeightChange} />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="settings-group">
                <div className="group-title"><Settings2 size={16} /> Batch Summary</div>
                <div className="specs-grid">
                  <div className="spec-item"><span className="spec-label">Total Clips</span><span className="spec-val">{clips.length}</span></div>
                  <div className="spec-item"><span className="spec-label">Total Duration</span><span className="spec-val">{formatTime(totalClipDuration)}</span></div>
                  <div className="spec-item"><span className="spec-label">Format</span><span className="spec-val">MP4 (H.264)</span></div>
                </div>
              </div>

              <button className="export-btn" onClick={handleBatchExport} disabled={processing}>
                {processing ? (
                  <><Loader2 className="animate-spin" size={20} /><span>{statusText || 'Rendering...'}</span></>
                ) : (
                  <><Download size={20} /><span>Export All {clips.length} Clip{clips.length > 1 ? 's' : ''}</span></>
                )}
              </button>

              {processing && (
                <div className="progress-container mt-4">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

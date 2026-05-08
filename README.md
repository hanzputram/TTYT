# 🌍 TrimTube Universal CLI

A professional-grade YouTube clipping engine designed for creators. Installable on any machine with Node.js.

## 🚀 Global Installation (NPM)

You can now install TrimTube directly from GitHub as a global command:

```bash
npm install -g https://github.com/USERNAME/trimtube-clone.git
```

### 🛠 Post-Install Setup
After installing, you need to initialize the environment once:
```bash
ttyt setup
```

### 🎬 Run
Launch the app anytime by typing:
```bash
ttyt run
```

---

## 🛠 Other Installation Methods

### 🐳 Docker (One-Command)
```bash
docker-compose up
```

### 💻 Native CLI (No Global Install)
- **Windows**: `.\ttyt.bat setup` then `ttyt run`
- **Mac/Linux**: `./ttyt.sh setup` then `./ttyt.sh run`

---

## 💻 Tech Stack
- **CLI Engine**: Node.js + Chalk + Concurrently
- **Backend**: FastAPI + FFmpeg + yt-dlp
- **Frontend**: React + Vite (PWA Enabled)

---
*Developed for instant, universal access across all devices.*

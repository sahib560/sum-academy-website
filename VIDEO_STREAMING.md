# Video Streaming (H.264 + HLS) for SUM Academy

This project can play:
- **MP4** videos directly in the browser (best when encoded as **H.264 + AAC** with `faststart`)
- **HLS** streams (`.m3u8` playlist) via `hls.js` (best for **large videos** and **lower buffering**)

The student live page (`frontend/src/pages/student/LiveSession.jsx`) will **prefer `hlsUrl`** if available, and fall back to `videoUrl` (MP4).

## 1) Convert Any MP4 -> Web-Compatible MP4 (H.264 + AAC + Fast Start)

```bash
ffmpeg -y -i "input.mp4" \
  -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p \
  -preset veryfast -crf 22 \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  "output_h264_faststart.mp4"
```

Notes:
- `-movflags +faststart` moves the moov atom to the beginning so the video starts faster.
- If the original video is **HEVC/H.265**, many browsers (especially some Android/desktop combos) will fail with decode errors. This command fixes that.

## 2) Convert MP4 -> HLS (.m3u8 + .ts segments)

### Single quality HLS (simple)

```bash
mkdir -p hls_720p
ffmpeg -y -i "output_h264_faststart.mp4" \
  -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 \
  -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "hls_720p/seg_%03d.ts" \
  "hls_720p/index.m3u8"
```

### Adaptive HLS (recommended: 360p + 720p + 1080p)

```bash
mkdir -p hls/v0 hls/v1 hls/v2
ffmpeg -y -i "output_h264_faststart.mp4" \
  -filter_complex "\
    [0:v]split=3[v360in][v720in][v1080in];\
    [v360in]scale=w=640:h=360:force_original_aspect_ratio=decrease[v360];\
    [v720in]scale=w=1280:h=720:force_original_aspect_ratio=decrease[v720];\
    [v1080in]scale=w=1920:h=1080:force_original_aspect_ratio=decrease[v1080]" \
  -map "[v360]"  -map 0:a -c:v:0 libx264 -b:v:0 800k  -maxrate:v:0 900k  -bufsize:v:0 1600k -c:a:0 aac -b:a:0 96k  -ac 2 \
  -map "[v720]"  -map 0:a -c:v:1 libx264 -b:v:1 2500k -maxrate:v:1 2800k -bufsize:v:1 5000k -c:a:1 aac -b:a:1 128k -ac 2 \
  -map "[v1080]" -map 0:a -c:v:2 libx264 -b:v:2 5000k -maxrate:v:2 5600k -bufsize:v:2 10000k -c:a:2 aac -b:a:2 160k -ac 2 \
  -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "hls/v%v/seg_%03d.ts" \
  -master_pl_name "master.m3u8" \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  "hls/v%v/index.m3u8"
```

## 3) HLS Output Structure

```text
hls/
  master.m3u8
  v0/
    index.m3u8
    seg_000.ts
    seg_001.ts
  v1/
    index.m3u8
    seg_000.ts
  v2/
    index.m3u8
    seg_000.ts
```

Upload the whole `hls/` folder to Firebase Storage and use the **public download URL** of `master.m3u8` as the `hlsUrl`.

## 4) React Playback (already integrated)

Frontend uses `hls.js` via [`frontend/src/components/HlsVideo.jsx`](frontend/src/components/HlsVideo.jsx).

In [`frontend/src/pages/student/LiveSession.jsx`](frontend/src/pages/student/LiveSession.jsx):
- If `sync.hlsUrl` (or `session.hlsUrl`) exists, it plays HLS using `hls.js`
- Else it plays MP4 (`videoUrl`)

## 5) Firebase Storage CORS (required for HLS)

HLS playback uses XHR/fetch to load `.m3u8` + `.ts` files, so your bucket must allow CORS from your web domain.

Example `cors.json`:

```json
[
  {
    "origin": ["https://sumacademy.net", "http://localhost:5173"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Accept-Ranges", "Content-Range", "Range"],
    "maxAgeSeconds": 3600
  }
]
```

Apply it (run from a machine with `gsutil`):

```bash
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

## 6) Best Practices (low buffering)

- Prefer **HLS** for large files (>200MB) and for students on mobile data.
- Keep segments `6s` (good balance).
- Use **H.264 + AAC** for maximum browser compatibility.
- Ensure Firebase objects have correct `Content-Type`:
  - `.m3u8`: `application/vnd.apple.mpegurl`
  - `.ts`: `video/mp2t`
  - `.mp4`: `video/mp4`


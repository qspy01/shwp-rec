# Media Pipeline Architecture

## 1. Overview
The media pipeline is responsible for capturing raw binary frames from the upstream websocket, saving them safely to disk, and converting them into a web-optimized `.mp4` container with associated metadata and thumbnails.

## 2. Capture Phase (Worker Recorder)
1. **Puppeteer Initialization:** `worker-recorder` launches a stealth Chromium page and navigates to the model's profile.
2. **WebSocket Interception:** The worker hooks into network traffic. When a connection to `storm` is detected, it binds to the `framereceived` event.
3. **Binary Chunking:** As binary payloads arrive, they are immediately appended to a WriteStream targeting a temporary shared volume (`/mnt/shared/captures/${streamUuid}.raw.mp4`).
4. **Health Monitor:** A local timeout checks if chunks stop arriving for > 90 seconds. If so, the stream is considered finished. The WriteStream is safely closed.

## 3. Processing Phase (Worker Processor)
Once the `RecordStreamJob` succeeds, a `ProcessMediaJob` is dispatched to the queue containing the `streamUuid` and `tempFilePath`.

1. **Format Normalization (FFmpeg):**
   - The raw chunks often lack correct MOOV atoms or have inconsistent audio codecs (Speex vs AAC) as seen in `convert.js`.
   - Command: `ffmpeg -i input.raw.mp4 -c:v copy -c:a aac -b:a 128k -movflags +faststart output.mp4`
   - `-movflags +faststart` ensures the MOOV atom is moved to the beginning of the file, allowing VODs to stream in the browser before fully downloading.
2. **Thumbnail Extraction:**
   - Command: `ffmpeg -i output.mp4 -ss 00:00:10 -vframes 1 thumbnail.jpg` (Captures a frame at 10 seconds).
3. **Metadata Extraction:**
   - `ffprobe` is run on the final `output.mp4` to extract precise `duration`, `resolution`, and `filesize`.

## 4. Storage & Publishing Phase
1. **Upload:** The `worker-processor` uploads `output.mp4` and `thumbnail.jpg` to the MinIO cluster under the `vods/` bucket.
2. **Cleanup:** The temporary raw files on the shared volume are deleted.
3. **Database Sync:** The `Stream` record in PostgreSQL is updated with the S3 object keys and the status is changed to `PUBLISHED`.

## 5. Delivery Phase
1. **Next.js Player:** The public frontend requests the video source.
2. **CDN Proxy:** The Next.js API or direct Nginx proxy serves the video directly from MinIO, utilizing HTTP Range Requests to support scrubbing.

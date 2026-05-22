'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  hlsUrl?: string | null;
  mp4Url?: string | null;
  posterUrl?: string | null;
}

export function HlsPlayer({ hlsUrl, mp4Url, posterUrl }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // Allow up to 30 segments in the buffer for VOD seeking
        maxBufferLength: 60,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[hls.js] fatal error', data);
          hls.destroy();
        }
      });
      return () => hls.destroy();
    }

    // Native HLS — Safari / iOS
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
    }
  }, [hlsUrl]);

  // Fallback: no HLS URL available (old stream processed before Sprint 3)
  const useMp4Fallback = !hlsUrl && mp4Url;

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="w-full block"
      poster={posterUrl ?? undefined}
      src={useMp4Fallback ? mp4Url : undefined}
    >
      {useMp4Fallback && <source src={mp4Url!} type="video/mp4" />}
      Your browser does not support HTML video.
    </video>
  );
}

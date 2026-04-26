// useYouTubePlayer — IFrame API wrapper with hidden player pattern
import { useRef, useCallback, useEffect, useState } from 'react';

export function useYouTubePlayer() {
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<string>('yt-player-container');

  useEffect(() => {
    // Inject the IFrame API script
    if (typeof window === 'undefined') return;
    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(tag, firstScript);

    (window as any).onYouTubeIframeAPIReady = initPlayer;

    function initPlayer() {
      if (playerRef.current) return;
      playerRef.current = new (window as any).YT.Player(containerRef.current, {
        height: '1',
        width: '1',
        videoId: '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => setReady(true),
        },
      });
    }

    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  const cueVideo = useCallback((videoId: string) => {
    playerRef.current?.cueVideoById(videoId);
  }, []);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const setVolume = useCallback((vol: number) => {
    playerRef.current?.setVolume(Math.round(vol));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    playerRef.current?.setPlaybackRate(rate);
  }, []);

  const getCurrentTime = useCallback((): number => {
    return playerRef.current?.getCurrentTime?.() || 0;
  }, []);

  const getDuration = useCallback((): number => {
    return playerRef.current?.getDuration?.() || 0;
  }, []);

  return {
    containerRef: containerRef.current,
    ready,
    cueVideo,
    play,
    pause,
    setVolume,
    setPlaybackRate,
    getCurrentTime,
    getDuration,
  };
}

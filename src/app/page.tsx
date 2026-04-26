"use client";

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports to avoid SSR issues with Canvas/Audio APIs
const VoidAwakening = dynamic(() => import('@/components/VoidAwakening'), { ssr: false });
const SearchCorridor = dynamic(() => import('@/components/SearchCorridor'), { ssr: false });
const IgnitionSequence = dynamic(() => import('@/components/IgnitionSequence'), { ssr: false });
const AwakeningSequence = dynamic(() => import('@/components/AwakeningSequence'), { ssr: false });
const Stage = dynamic(() => import('@/components/Stage'), { ssr: false });

type AppScreen = 'void' | 'awakening' | 'search' | 'ignition' | 'stage';

interface TrackData {
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
  lyrics: any[];
}

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>('void');
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [lyricsLoaded, setLyricsLoaded] = useState(false);

  const handleAwaken = useCallback(() => {
    setScreen('awakening');
  }, []);

  const handleAwakeningComplete = useCallback(() => {
    setScreen('search');
  }, []);

  const handleSelect = useCallback(async (result: { videoId: string; title: string; thumbnail?: string }) => {
    const cleanTitle = result.title
      .replace(/\(Official.*?\)/gi, '')
      .replace(/\[Official.*?\]/gi, '')
      .replace(/- YouTube/gi, '')
      .replace(/4K/gi, '')
      .replace(/Music Video/gi, '')
      .replace(/\|.*$/g, '')
      .trim();

    // Extract artist from title (before the dash)
    const parts = cleanTitle.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : '';
    const songTitle = parts.length > 1 ? parts.slice(1).join(' - ').trim() : cleanTitle;

    setTrackData({
      videoId: result.videoId,
      title: songTitle || cleanTitle,
      artist,
      thumbnail: result.thumbnail,
      lyrics: [],
    });
    setLyricsLoaded(false);
    setLoadProgress(30);
    setScreen('ignition');

    // Fetch lyrics
    try {
      setLoadProgress(60);
      const lyrRes = await fetch(`/api/lyrics?videoId=${result.videoId}&title=${encodeURIComponent(cleanTitle)}`);
      const lyrData = await lyrRes.json();
      setLoadProgress(90);

      setTrackData(prev => prev ? { ...prev, lyrics: lyrData.lyrics || [] } : null);
      setLoadProgress(100);
      setLyricsLoaded(true);
    } catch {
      setLoadProgress(100);
      setLyricsLoaded(true);
    }
  }, []);

  const handleIgnitionReady = useCallback(() => {
    setScreen('stage');
  }, []);

  const handleStageExit = useCallback(() => {
    setScreen('search');
  }, []);

  return (
    <main className="min-h-screen bg-black overflow-hidden">
      {screen === 'void' && (
        <VoidAwakening onAwaken={handleAwaken} />
      )}

      {screen === 'awakening' && (
        <AwakeningSequence onComplete={handleAwakeningComplete} />
      )}

      {screen === 'search' && (
        <SearchCorridor
          onSelect={handleSelect}
          onCancel={() => setScreen('void')}
        />
      )}

      {screen === 'ignition' && trackData && (
        <IgnitionSequence
          title={trackData.title}
          artist={trackData.artist}
          thumbnail={trackData.thumbnail}
          loaded={lyricsLoaded}
          progress={loadProgress}
          onReady={handleIgnitionReady}
        />
      )}

      {screen === 'stage' && trackData && (
        <Stage
          videoId={trackData.videoId}
          title={trackData.title}
          lyrics={trackData.lyrics}
          onExit={handleStageExit}
        />
      )}
    </main>
  );
}

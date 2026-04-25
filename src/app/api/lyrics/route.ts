import { NextResponse } from 'next/server';
const { getSubtitles } = require('youtube-captions-scraper');
const lyricsFinder = require('lyrics-finder');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';
  const title = searchParams.get('title') || '';

  let captions: any[] = [];
  let source = 'NONE';

  // 1. ADVANCED YOUTUBE CAPTION DISCOVERY
  if (videoId) {
    const langCodes = ['en', 'en-US', 'en-GB', 'a.en'];
    for (const lang of langCodes) {
      try {
        const subtitles = await getSubtitles({ videoID: videoId, lang });
        if (subtitles && subtitles.length > 0) {
          captions = subtitles.map((s: any) => ({
            start: parseFloat(s.start),
            dur: parseFloat(s.dur),
            text: s.text.replace(/&amp;#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;nbsp;/g, ' ')
          }));
          source = 'YOUTUBE_SYNC';
          break;
        }
      } catch (e) {}
    }
  }

  // 2. DEDICATED LYRICS API (Lyrics.ovh)
  if (captions.length === 0 && title) {
    try {
      let artist = '';
      let song = title;
      if (title.includes(' - ')) [artist, song] = title.split(' - ');
      
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist.trim())}/${encodeURIComponent(song.trim())}`);
      const data = await res.json();
      
      if (data.lyrics) {
        const lines = data.lyrics.split('\n').filter((l: string) => l.trim().length > 0);
        captions = lines.map((text: string, i: number) => ({
          start: i * 5,
          dur: 4,
          text: text.trim()
        }));
        source = 'LYRICS_OVH';
      }
    } catch (e) {}
  }

  // 3. SECONDARY WEB SCRAPE (lyrics-finder)
  if (captions.length === 0 && title) {
    try {
      let artist = '';
      let song = title;
      if (title.includes(' - ')) [artist, song] = title.split(' - ');
      
      const rawLyrics = await lyricsFinder(artist, song);
      if (rawLyrics) {
        const lines = rawLyrics.split('\n').filter((l: string) => l.trim().length > 0);
        captions = lines.map((text: string, i: number) => ({
          start: i * 5,
          dur: 4,
          text: text.trim()
        }));
        source = 'WEB_SCRAPE';
      }
    } catch (e) {}
  }

  return NextResponse.json({ lyrics: captions, source });
}

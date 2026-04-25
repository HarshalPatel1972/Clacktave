import { NextResponse } from 'next/server';
const { getSubtitles } = require('youtube-captions-scraper');
const lyricsFinder = require('lyrics-finder');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';
  const title = searchParams.get('title') || '';

  let captions: any[] = [];
  let source = 'NONE';

  // STRATEGY 1: YouTube Synced Captions
  if (videoId) {
    const langs = ['en', 'en-GB', 'en-US', 'a.en']; 
    for (const lang of langs) {
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

  // STRATEGY 2: Web Lyrics Fallback (Unsynced)
  if (captions.length === 0 && title) {
    try {
        let artist = '';
        let song = title;
        // Handle "Artist - Song" or "Artist: Song"
        if (title.includes(' - ')) [artist, song] = title.split(' - ');
        else if (title.includes(': ')) [artist, song] = title.split(': ');
        
        const rawLyrics = await lyricsFinder(artist.trim(), song.trim());
        if (rawLyrics) {
            const lines = rawLyrics.split('\n').filter((l: string) => l.trim().length > 0);
            captions = lines.map((text: string, i: number) => ({
                start: i * 5, 
                dur: 4,
                text: text.trim()
            }));
            source = 'WEB_FETCH';
        }
    } catch (e) {}
  }

  // Final check: if still nothing, try searching the title directly as the song name
  if (captions.length === 0 && title) {
      try {
          const fallbackLyrics = await lyricsFinder('', title);
          if (fallbackLyrics) {
              const lines = fallbackLyrics.split('\n').filter((l: string) => l.trim().length > 0);
              captions = lines.map((text: string, i: number) => ({
                  start: i * 5, 
                  dur: 4,
                  text: text.trim()
              }));
              source = 'FALLBACK_WEB';
          }
      } catch (e) {}
  }

  return NextResponse.json({ lyrics: captions, source });
}

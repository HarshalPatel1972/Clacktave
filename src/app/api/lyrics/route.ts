import { NextResponse } from 'next/server';
const { getSubtitles } = require('youtube-captions-scraper');
const lyricsFinder = require('lyrics-finder');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';
  const title = searchParams.get('title') || '';

  let captions: any[] = [];

  // STRATEGY 1: YouTube Synced Captions
  if (videoId) {
    const langs = ['en', 'en-US', 'a.en']; 
    for (const lang of langs) {
        try {
            const subtitles = await getSubtitles({ videoID: videoId, lang });
            if (subtitles && subtitles.length > 0) {
                captions = subtitles.map((s: any) => ({
                    start: parseFloat(s.start),
                    dur: parseFloat(s.dur),
                    text: s.text.replace(/&amp;#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;nbsp;/g, ' ')
                }));
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
        if (title.includes(' - ')) [artist, song] = title.split(' - ');
        
        const rawLyrics = await lyricsFinder(artist, song);
        if (rawLyrics) {
            const lines = rawLyrics.split('\n').filter((l: string) => l.trim().length > 0);
            // Create "fake" timestamps distributed across a standard 3.5 min duration (fallback)
            captions = lines.map((text: string, i: number) => ({
                start: i * 5, // 5 seconds per line as an estimate
                dur: 4,
                text: text.trim()
            }));
        }
    } catch (e) {}
  }

  return NextResponse.json({ lyrics: captions });
}

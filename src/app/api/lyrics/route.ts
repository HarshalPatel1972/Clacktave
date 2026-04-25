import { NextResponse } from 'next/server';
const { getSubtitles } = require('youtube-captions-scraper');
const lyricsFinder = require('lyrics-finder');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';
  const title = searchParams.get('title') || '';

  let captions: any[] = [];
  let source = 'NONE';

  // 1. ATTEMPT LRC DATABASE SEARCH (The Gold Standard for Rhythmic Soul)
  if (title) {
      try {
          const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`);
          const lrcData = await lrcRes.json();
          
          if (lrcData && lrcData.length > 0) {
              const bestMatch = lrcData[0];
              if (bestMatch.syncedLyrics) {
                  const lrcLines = bestMatch.syncedLyrics.split('\n');
                  const parsed = lrcLines.map((line: string) => {
                      const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
                      if (match) {
                          return {
                              start: parseInt(match[1]) * 60 + parseFloat(match[2]),
                              text: match[3].trim()
                          };
                      }
                      return null;
                  }).filter(Boolean);

                  // Calculate duration based on the next line's start time
                  captions = parsed.map((line, i) => ({
                      ...line,
                      dur: i < parsed.length - 1 ? (parsed[i+1].start - line.start) : 5
                  }));
                  source = 'LRC_LIB_SYNC';
              }
          }
      } catch (e) {}
  }

  // 2. ATTEMPT DEEP YOUTUBE CAPTION EXTRACTION (If LRC fails)
  if (captions.length === 0 && videoId) {
    const langCodes = ['en', 'en-US', 'en-GB', 'a.en', 'en-CA', 'en-AU'];
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

  // 3. FALLBACK TO PLAIN TEXT (If all else fails)
  if (captions.length === 0 && title) {
    try {
      let artist = ''; let song = title;
      if (title.includes(' - ')) [artist, song] = title.split(' - ');
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist.trim())}/${encodeURIComponent(song.trim())}`);
      const data = await res.json();
      if (data.lyrics) {
        const lines = data.lyrics.split('\n').filter((l: string) => l.trim().length > 0);
        captions = lines.map((text: string, i: number) => ({ start: i * 5, dur: 4, text: text.trim() }));
        source = 'LYRICS_OVH';
      }
    } catch (e) {}
  }

  return NextResponse.json({ lyrics: captions, source });
}

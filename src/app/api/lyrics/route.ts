import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';
  const title = searchParams.get('title') || '';

  let captions: any[] = [];
  let source = 'NONE';

  if (videoId) {
    try {
      const videoPageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      const html = await videoPageRes.text();
      const match = html.match(/"captionTracks":\s*(\[.*?\])/);
      
      if (match) {
        const tracks = JSON.parse(match[1]);
        const track = tracks.find((t: any) => t.vssId === '.en') || 
                      tracks.find((t: any) => t.vssId === 'a.en') ||
                      tracks.find((t: any) => t.languageCode.startsWith('en')) || 
                      tracks[0];
        
        if (track && track.baseUrl) {
          const captionRes = await fetch(`${track.baseUrl}&fmt=json3`);
          const captionData = await captionRes.json();
          
          if (captionData.events) {
            captions = captionData.events
              .filter((ev: any) => ev.segs && ev.tStartMs !== undefined)
              .map((ev: any) => {
                const words = ev.segs.map((s: any) => ({
                    text: s.utf8,
                    offset: (s.tOffsetMs || 0) / 1000
                }));
                return {
                  start: ev.tStartMs / 1000,
                  dur: ev.dDurationMs ? ev.dDurationMs / 1000 : 3,
                  text: words.map((w: any) => w.text).join('').trim(),
                  words: words // Individual word timing for 10/10 highlighting
                };
              })
              .filter((c: any) => c.text.length > 0);

            source = track.vssId === 'a.en' ? 'YOUTUBE_AUTO_SYNC' : 'YOUTUBE_MANUAL_SYNC';
          }
        }
      }
    } catch (e) {}
  }

  // FALLBACK: LRCLib
  if (captions.length === 0 && title) {
      try {
          const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`);
          const lrcData = await lrcRes.json();
          if (lrcData && lrcData.length > 0 && lrcData[0].syncedLyrics) {
              const parsed = lrcData[0].syncedLyrics.split('\n').map((line: string) => {
                  const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
                  if (match) return { start: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
                  return null;
              }).filter(Boolean);
              captions = parsed.map((line: any, i: number) => ({
                  ...line,
                  dur: i < parsed.length - 1 ? (parsed[i+1].start - line.start) : 5,
                  words: [{ text: line.text, offset: 0 }]
              }));
              source = 'LRC_LIB_SYNC';
          }
      } catch (e) {}
  }

  return NextResponse.json({ lyrics: captions, source });
}

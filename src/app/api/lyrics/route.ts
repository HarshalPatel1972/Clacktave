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
        // Priority: Manual English -> Auto-generated English -> Any English
        const track = tracks.find((t: any) => t.vssId === '.en') || 
                      tracks.find((t: any) => t.vssId === 'a.en') ||
                      tracks.find((t: any) => t.languageCode.startsWith('en')) || 
                      tracks[0];
        
        if (track && track.baseUrl) {
          const captionRes = await fetch(`${track.baseUrl}&fmt=json3`);
          const captionData = await captionRes.json();
          
          if (captionData.events) {
            // ROLLING BUFFER PARSER
            let lastText = "";
            captions = captionData.events
              .filter((ev: any) => ev.segs && ev.tStartMs !== undefined)
              .map((ev: any) => {
                const text = ev.segs.map((s: any) => s.utf8).join('').trim();
                if (!text || text === lastText) return null;
                lastText = text;
                return {
                  start: ev.tStartMs / 1000,
                  // Auto-captions don't have reliable durations, 
                  // we calculate them as the distance to the NEXT event
                  text: text
                };
              })
              .filter(Boolean);

            // Calculate exact durations based on subsequent event starts
            captions = captions.map((c: any, i: number) => ({
              ...c,
              dur: i < captions.length - 1 ? Math.min(captions[i+1].start - c.start, 5) : 3
            }));

            source = track.vssId === 'a.en' ? 'YOUTUBE_AUTO_SYNC' : 'YOUTUBE_MANUAL_SYNC';
          }
        }
      }
    } catch (e) {}
  }

  // FALLBACK: LRCLib (Highly synced)
  if (captions.length === 0 && title) {
      try {
          const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`);
          const lrcData = await lrcRes.json();
          if (lrcData && lrcData.length > 0 && lrcData[0].syncedLyrics) {
              const lrcLines = lrcData[0].syncedLyrics.split('\n');
              const parsed = lrcLines.map((line: string) => {
                  const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
                  if (match) return { start: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
                  return null;
              }).filter(Boolean);
              captions = parsed.map((line: any, i: number) => ({
                  ...line,
                  dur: i < parsed.length - 1 ? (parsed[i+1].start - line.start) : 5
              }));
              source = 'LRC_LIB_SYNC';
          }
      } catch (e) {}
  }

  return NextResponse.json({ lyrics: captions, source });
}

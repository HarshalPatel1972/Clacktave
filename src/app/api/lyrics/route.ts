import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';
  const title = searchParams.get('title') || '';

  let captions: any[] = [];
  let source = 'NONE';

  // 1. THE "INTERNAL YOUTUBE" METHOD (JSON3)
  if (videoId) {
    try {
      // Fetch the video page to get player data
      const videoPageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      const html = await videoPageRes.text();
      
      // Extract caption tracks info from ytInitialPlayerResponse
      const match = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (match) {
        const tracks = JSON.parse(match[1]);
        // Find English or fallback to first track
        const track = tracks.find((t: any) => t.languageCode.startsWith('en')) || tracks[0];
        
        if (track && track.baseUrl) {
          // Fetch the JSON3 formatted captions
          const captionRes = await fetch(`${track.baseUrl}&fmt=json3`);
          const captionData = await captionRes.json();
          
          if (captionData.events) {
            captions = captionData.events
              .filter((ev: any) => ev.segs)
              .map((ev: any) => ({
                start: ev.tStartMs / 1000,
                dur: ev.dDurationMs / 1000,
                text: ev.segs.map((s: any) => s.utf8).join('').trim()
              }))
              .filter((c: any) => c.text.length > 0);
            source = 'YOUTUBE_INTERNAL_JSON3';
          }
        }
      }
    } catch (e) {
      console.error("Internal YouTube Fetch Error:", e);
    }
  }

  // 2. BACKUP: LRC DATABASE (If internal fails)
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

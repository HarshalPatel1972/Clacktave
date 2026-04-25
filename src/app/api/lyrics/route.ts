import { NextResponse } from 'next/server';
const { getSubtitles } = require('youtube-captions-scraper');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';

  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });

  // Try different language variations to ensure we get a hit
  const langs = ['en', 'en-US', 'a.en']; 
  
  for (const lang of langs) {
    try {
      const subtitles = await getSubtitles({
        videoID: videoId,
        lang: lang
      });

      if (subtitles && subtitles.length > 0) {
        return NextResponse.json({ 
          lyrics: subtitles.map((s: any) => ({
            start: parseFloat(s.start),
            dur: parseFloat(s.dur),
            text: s.text.replace(/&amp;#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;nbsp;/g, ' ')
          }))
        });
      }
    } catch (e) {
      continue; // Try next language
    }
  }

  return NextResponse.json({ lyrics: [] });
}

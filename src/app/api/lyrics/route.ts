import { NextResponse } from 'next/server';
const { getSubtitles } = require('youtube-captions-scraper');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || '';

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  try {
    const subtitles = await getSubtitles({
      videoID: videoId,
      lang: 'en'
    });

    // Subtitles come in format: { start: string, dur: string, text: string }
    return NextResponse.json({ 
      lyrics: subtitles.map((s: any) => ({
        start: parseFloat(s.start),
        dur: parseFloat(s.dur),
        text: s.text.replace(/&amp;#39;/g, "'").replace(/&quot;/g, '"')
      }))
    });
  } catch (error) {
    console.error('Caption Fetch Error:', error);
    // Fallback to empty if captions are unavailable
    return NextResponse.json({ lyrics: [] });
  }
}

import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const YT_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  console.log(`[SEARCH] Init for query: "${q}" | Key Present: ${!!YT_API_KEY}`);

  try {
    // 1. ATTEMPT OFFICIAL YOUTUBE API V3
    if (YT_API_KEY) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(q)}&type=video&key=${YT_API_KEY}`;
      
      const apiRes = await fetch(apiUrl);

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.items && data.items.length > 0) {
          const results = data.items.map((item: any) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
          }));

          return NextResponse.json({ results });
        }
      } else {
        const errorText = await apiRes.text();
        console.error(`[SEARCH] Google API Error ${apiRes.status}:`, errorText);
        // If it's a key error, we'll fall through to scraper
      }
    }

    // 2. FALLBACK TO SCRAPER
    console.log(`[SEARCH] Falling back to scraper logic...`);
    const r = await ytSearch(q);
    if (r && r.videos && r.videos.length > 0) {
      const videos = r.videos.slice(0, 5);
      return NextResponse.json({
        results: videos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          channelTitle: v.author?.name || '',
          thumbnail: v.thumbnail || v.image,
        }))
      });
    }

    return NextResponse.json({ error: 'No results found from any source' }, { status: 404 });

  } catch (error: any) {
    console.error('[SEARCH] Critical Exception:', error);
    return NextResponse.json({ 
      error: 'Search failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

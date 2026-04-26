import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';

export const runtime = 'nodejs'; // Ensure we have access to process.env

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const YT_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    // 1. ATTEMPT OFFICIAL YOUTUBE API V3
    if (YT_API_KEY) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(q)}&type=video&key=${YT_API_KEY}`;
      
      const apiRes = await fetch(apiUrl, { cache: 'no-store' });

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.items && data.items.length > 0) {
          const results = data.items.map((item: any) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
          }));

          return NextResponse.json({ results, source: 'official_api' });
        }
      } else {
        const errorData = await apiRes.json().catch(() => ({}));
        console.error(`[SEARCH] Google API Rejection:`, errorData);
        
        // Return the Google error directly so we can diagnose
        return NextResponse.json({ 
          error: 'Google API Rejected Key',
          status: apiRes.status,
          details: errorData.error?.message || 'Check Google Cloud Console for restrictions',
          key_detected: true
        }, { status: 502 });
      }
    }

    // 2. FALLBACK TO SCRAPER (Only if no key or key failed)
    const r = await ytSearch(q);
    if (r && r.videos && r.videos.length > 0) {
      const videos = r.videos.slice(0, 5);
      return NextResponse.json({
        results: videos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          channelTitle: v.author?.name || '',
          thumbnail: v.thumbnail || v.image,
        })),
        source: 'scraper_fallback',
        key_detected: !!YT_API_KEY
      });
    }

    return NextResponse.json({ error: 'No results found', key_detected: !!YT_API_KEY }, { status: 404 });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Search critical failure',
      details: error.message,
      key_detected: !!YT_API_KEY
    }, { status: 500 });
  }
}

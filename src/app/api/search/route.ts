import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';

// USE ENVIRONMENT VARIABLE ONLY FOR SECURITY
const YT_API_KEY = process.env.YOUTUBE_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  if (!YT_API_KEY) {
    console.warn('[SEARCH] No YOUTUBE_API_KEY provided. Falling back to scraper.');
  }

  try {
    // 1. ATTEMPT OFFICIAL YOUTUBE API V3 (If Key Exists)
    if (YT_API_KEY) {
      console.log(`[SEARCH] Official API Call: "${q}"`);
      const apiRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(q)}&type=video&key=${YT_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.items && data.items.length > 0) {
          const results = data.items.map((item: any) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
          }));

          return NextResponse.json({
            results,
            videoId: results[0].videoId,
            title: results[0].title,
            thumbnail: results[0].thumbnail,
          });
        }
      }
    }

    // 2. FALLBACK TO SCRAPER
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
        videoId: videos[0].videoId,
        title: videos[0].title,
        thumbnail: videos[0].thumbnail || videos[0].image,
      });
    }

    return NextResponse.json({ error: 'No results found' }, { status: 404 });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Search failed',
      details: error.message
    }, { status: 500 });
  }
}

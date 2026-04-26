import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  try {
    console.log(`[SEARCH] Query: "${q}"`);
    const r = await ytSearch(q);
    
    if (!r || !r.videos) {
      console.error('[SEARCH] No response or videos property from yt-search');
      return NextResponse.json({ error: 'Invalid response from search provider' }, { status: 502 });
    }

    const videos = r.videos.slice(0, 5);
    console.log(`[SEARCH] Found ${videos.length} results`);

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No results found' }, { status: 404 });
    }

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
  } catch (error: any) {
    console.error('[SEARCH] Critical Failure:', error.message || error);
    return NextResponse.json({ 
      error: 'Search failed in production environment',
      details: error.message
    }, { status: 500 });
  }
}

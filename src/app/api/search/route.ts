import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  try {
    const r = await ytSearch(q);
    // Return up to 5 results for the Autocomplete Ring
    const videos = r.videos.slice(0, 5);

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
      // Backward compat: also return first result flat
      videoId: videos[0].videoId,
      title: videos[0].title,
      thumbnail: videos[0].thumbnail || videos[0].image,
    });
  } catch (error) {
    console.error('YouTube Search Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

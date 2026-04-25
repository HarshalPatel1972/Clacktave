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
    // Return the first video result
    const video = r.videos[0];
    
    if (!video) {
      return NextResponse.json({ error: 'No results found' }, { status: 404 });
    }

    return NextResponse.json({ 
      videoId: video.videoId,
      title: video.title,
      thumbnail: video.thumbnail
    });
  } catch (error) {
    console.error('YouTube Search Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

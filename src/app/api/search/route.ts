import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const YT_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  // DEBUG LOG FOR VERCEL
  console.log(`[SEARCH_DEBUG] Query: ${q} | Key Present: ${!!YT_API_KEY}`);

  if (!YT_API_KEY) {
    return NextResponse.json({ 
      error: 'Missing YOUTUBE_API_KEY', 
      details: 'Please add YOUTUBE_API_KEY to your Vercel Environment Variables.' 
    }, { status: 500 });
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(q)}&type=video&key=${YT_API_KEY}`;
    
    const apiRes = await fetch(apiUrl, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store' 
    });

    if (!apiRes.ok) {
      const errorData = await apiRes.json().catch(() => ({}));
      return NextResponse.json({ 
        error: 'Google API Error',
        status: apiRes.status,
        details: errorData.error?.message || 'Check your API Key in Google Cloud Console'
      }, { status: apiRes.status === 403 ? 403 : 502 });
    }

    const data = await apiRes.json();
    
    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results = data.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
    }));

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('[SEARCH_CRITICAL]', error);
    return NextResponse.json({ 
      error: 'Search critical failure',
      details: error.message
    }, { status: 500 });
  }
}

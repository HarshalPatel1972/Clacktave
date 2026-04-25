import { NextResponse } from 'next/server';
const lyricsFinder = require('lyrics-finder');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || '';

  if (!title) {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 });
  }

  try {
    // Attempt to split title if it's "Artist - Song" or similar
    let artist = '';
    let song = title;
    
    if (title.includes(' - ')) {
      [artist, song] = title.split(' - ');
    }

    const lyrics = await lyricsFinder(artist, song);
    
    if (!lyrics) {
      return NextResponse.json({ lyrics: "INSTRUMENTAL / NO LYRICS FOUND" });
    }

    // Split lyrics into lines and remove empty ones
    const lines = lyrics.split('\n').filter((l: string) => l.trim().length > 0);

    return NextResponse.json({ 
      lyrics: lines 
    });
  } catch (error) {
    console.error('Lyrics Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch lyrics' }, { status: 500 });
  }
}

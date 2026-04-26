declare module 'yt-search' {
  interface VideoResult {
    videoId: string;
    title: string;
    thumbnail: string;
    image: string;
    author: { name: string };
    url: string;
    duration: { seconds: number; timestamp: string };
  }

  interface SearchResult {
    videos: VideoResult[];
  }

  function ytSearch(query: string): Promise<SearchResult>;
  export default ytSearch;
}

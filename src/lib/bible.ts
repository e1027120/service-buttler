// ----------------------------------------------------------------------------
// Bible Verse Fetcher & Local Cache
// Uses the free, open bible-api.com service and caches responses in memory & localStorage.
// ----------------------------------------------------------------------------

export interface VerseResult {
  reference: string;
  text: string;
  translation_name?: string;
}

const memoryCache = new Map<string, VerseResult>();

export async function fetchBibleVerse(reference: string): Promise<VerseResult | null> {
  const query = reference.trim();
  if (!query) return null;

  const cacheKey = `sb_bible:${query.toLowerCase().replace(/\s+/g, '+')}`;

  // Check in-memory cache first
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as VerseResult;
      memoryCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {
    /* ignore storage read errors */
  }

  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://bible-api.com/${encoded}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.text) return null;

    const result: VerseResult = {
      reference: data.reference || query,
      text: data.text.trim(),
      translation_name: data.translation_name || 'WEB',
    };

    memoryCache.set(cacheKey, result);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch {
      /* ignore storage quota errors */
    }

    return result;
  } catch (err) {
    console.warn(`Could not load Bible verse for "${query}":`, err);
    return null;
  }
}

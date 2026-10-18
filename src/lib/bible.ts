// ----------------------------------------------------------------------------
// Bible Verse Fetcher & Local Cache
// Uses the free, open bible-api.com service and caches responses in memory & localStorage.
// ----------------------------------------------------------------------------

export interface VerseResult {
  reference: string;
  text: string;
  translation_id?: string;
  translation_name?: string;
}

export interface BibleTranslation {
  id: string;
  name: string;
  shortName: string;
}

export const SUPPORTED_TRANSLATIONS: BibleTranslation[] = [
  { id: 'web', name: 'World English Bible', shortName: 'WEB' },
  { id: 'kjv', name: 'King James Version', shortName: 'KJV' },
  { id: 'bbe', name: 'Bible in Basic English', shortName: 'BBE' },
  { id: 'oeb-us', name: 'Open English Bible (US)', shortName: 'OEB' },
  { id: 'webbe', name: 'World English Bible (British)', shortName: 'WEB-BE' },
  { id: 'rvr', name: 'Reina Valera (Spanish)', shortName: 'RVR' },
  { id: 'almeida', name: 'Almeida (Portuguese)', shortName: 'Almeida' },
];

const memoryCache = new Map<string, VerseResult>();

export async function fetchBibleVerse(
  reference: string,
  translation = 'web'
): Promise<VerseResult | null> {
  const query = reference.trim();
  if (!query) return null;

  const trans = translation.toLowerCase().trim() || 'web';
  const cacheKey = `sb_bible:${trans}:${query.toLowerCase().replace(/\s+/g, '+')}`;

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
    const res = await fetch(`https://bible-api.com/${encoded}?translation=${encodeURIComponent(trans)}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.text) return null;

    const result: VerseResult = {
      reference: data.reference || query,
      text: data.text.trim(),
      translation_id: trans,
      translation_name: data.translation_name || trans.toUpperCase(),
    };

    memoryCache.set(cacheKey, result);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch {
      /* ignore storage quota errors */
    }

    return result;
  } catch (err) {
    console.warn(`Could not load Bible verse for "${query}" (${trans}):`, err);
    return null;
  }
}

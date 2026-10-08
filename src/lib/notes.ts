import type { SermonSlide } from './types';

export interface SavedSermonNote {
  actionId: string;
  sermonId?: string;
  churchSlug?: string;
  churchName?: string;
  serviceName?: string;
  title: string;
  speaker?: string;
  mainVerse?: string;
  date: string; // ISO date string or formatted date
  notes: string;
  slides?: SermonSlide[];
  fullSermonText?: string;
  updatedAt: number; // timestamp
}

const NOTES_PREFIX = 'sb_notes:';
const META_PREFIX = 'sb_notes_meta:';

/**
 * Save or update note metadata along with the raw text.
 */
export function saveSermonNote(
  actionId: string,
  notes: string,
  meta?: {
    sermonId?: string;
    churchSlug?: string;
    churchName?: string;
    serviceName?: string;
    title: string;
    speaker?: string;
    mainVerse?: string;
    slides?: SermonSlide[];
    fullSermonText?: string;
  }
) {
  try {
    const key = `${NOTES_PREFIX}${actionId}`;
    localStorage.setItem(key, notes);

    const metaKey = `${META_PREFIX}${actionId}`;
    const existingMetaRaw = localStorage.getItem(metaKey);
    let existing: Partial<SavedSermonNote> = {};
    if (existingMetaRaw) {
      try {
        existing = JSON.parse(existingMetaRaw);
      } catch {
        /* fallback */
      }
    }

    const updatedRecord: SavedSermonNote = {
      actionId,
      sermonId: meta?.sermonId ?? existing.sermonId,
      churchSlug: meta?.churchSlug ?? existing.churchSlug,
      churchName: meta?.churchName ?? existing.churchName,
      serviceName: meta?.serviceName ?? existing.serviceName,
      title: meta?.title || existing.title || 'Sermon Notes',
      speaker: meta?.speaker ?? existing.speaker,
      mainVerse: meta?.mainVerse ?? existing.mainVerse,
      date: existing.date || new Date().toISOString(),
      notes,
      slides: meta?.slides ?? existing.slides,
      fullSermonText: meta?.fullSermonText ?? existing.fullSermonText,
      updatedAt: Date.now(),
    };

    localStorage.setItem(metaKey, JSON.stringify(updatedRecord));
  } catch (err) {
    console.warn('Failed to save sermon note to localStorage:', err);
  }
}

/**
 * Get all stored sermon notes on this device.
 * Gracefully discovers both indexed notes (with metadata) and legacy raw `sb_notes:<id>` entries.
 */
export function getAllSavedSermonNotes(churchSlugFilter?: string): SavedSermonNote[] {
  const notesList: SavedSermonNote[] = [];
  const handledIds = new Set<string>();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(META_PREFIX)) {
        const actionId = key.substring(META_PREFIX.length);
        handledIds.add(actionId);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as SavedSermonNote;
            // Also ensure the latest note text from sb_notes:actionId is used if available
            const currentText = localStorage.getItem(`${NOTES_PREFIX}${actionId}`);
            if (currentText !== null) {
              parsed.notes = currentText;
            }
            if (!churchSlugFilter || !parsed.churchSlug || parsed.churchSlug === churchSlugFilter) {
              notesList.push(parsed);
            }
          }
        } catch {
          /* ignore corrupted item */
        }
      }
    }

    // Look for any legacy sb_notes: that didn't have meta yet
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(NOTES_PREFIX)) continue;
      const actionId = key.substring(NOTES_PREFIX.length);
      if (handledIds.has(actionId)) continue;

      const text = localStorage.getItem(key);
      if (text && text.trim().length > 0) {
        notesList.push({
          actionId,
          title: 'Sermon Notes',
          date: new Date().toISOString(),
          notes: text,
          updatedAt: Date.now(),
        });
      }
    }
  } catch (err) {
    console.warn('Error reading notes from localStorage:', err);
  }

  // Sort newest first
  return notesList.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a specific saved sermon note.
 */
export function deleteSavedSermonNote(actionId: string) {
  try {
    localStorage.removeItem(`${NOTES_PREFIX}${actionId}`);
    localStorage.removeItem(`${META_PREFIX}${actionId}`);
  } catch (err) {
    console.warn('Error deleting sermon note:', err);
  }
}

/**
 * Clear all saved sermon notes from this device.
 */
export function clearAllSavedSermonNotes(churchSlugFilter?: string) {
  try {
    const all = getAllSavedSermonNotes(churchSlugFilter);
    for (const note of all) {
      deleteSavedSermonNote(note.actionId);
    }
  } catch (err) {
    console.warn('Error clearing sermon notes:', err);
  }
}

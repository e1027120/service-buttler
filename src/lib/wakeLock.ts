import { useEffect, useRef, useState } from 'react';

/**
 * Hook to keep the screen awake using the Screen Wake Lock API.
 * Works natively in Chrome/Edge, Android, Safari (iOS 16.4+), and installed PWAs.
 */
export function useScreenWakeLock(enabled = true) {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<any>(null);

  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let isMounted = true;

    async function acquireLock() {
      try {
        if (document.visibilityState !== 'visible') return;
        if (sentinelRef.current && !sentinelRef.current.released) return;

        const sentinel = await (navigator as any).wakeLock.request('screen');
        if (!isMounted) {
          sentinel.release();
          return;
        }

        sentinelRef.current = sentinel;
        setIsActive(true);

        sentinel.addEventListener('release', () => {
          if (isMounted) setIsActive(false);
        });
      } catch (err) {
        // Wake lock can fail if battery saver is on or user denied permission
        setIsActive(false);
      }
    }

    acquireLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };
  }, [enabled]);

  return { isSupported, isActive };
}

import { useEffect, useRef } from 'react';

/**
 * useBackTrap
 * Intercepts browser / hardware Back button presses when a modal, sub-screen,
 * or overlay is active (isActive === true).
 * 
 * When user presses Back, onBack() is called to close the overlay gracefully
 * instead of navigating away or exiting the app.
 */
export function useBackTrap(isActive: boolean, onBack: () => void, trapKey = 'modal') {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const pushedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !isActive) return;

    // Push a lightweight history entry for this trap
    const trapStateId = `trap_${trapKey}_${Date.now()}`;
    window.history.pushState({ isTrap: true, trapStateId }, '', window.location.hash || '#');
    pushedRef.current = true;

    const handlePopState = (e: PopStateEvent) => {
      // If we popped out of our trap state
      if (pushedRef.current) {
        pushedRef.current = false;
        onBackRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // If modal was closed via button / backdrop rather than browser back,
      // silently pop the trap history state so history remains clean
      if (pushedRef.current) {
        pushedRef.current = false;
        if (window.history.state?.isTrap && window.history.state?.trapStateId === trapStateId) {
          window.history.back();
        }
      }
    };
  }, [isActive, trapKey]);
}

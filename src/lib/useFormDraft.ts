import { useState, useEffect, useCallback } from 'react';

interface DraftWrapper<T> {
  data: T;
  savedAt: string;
}

/**
 * Hook for persisting and restoring in-progress form drafts to localStorage.
 * Prevents staff data loss when signal drops, tabs close, or devices sleep.
 */
export function useFormDraft<T>(
  draftKey: string,
  enabled: boolean = true
) {
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`draft_${draftKey}`);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftWrapper<T>;
        if (parsed && parsed.data) {
          setHasDraft(true);
          if (parsed.savedAt) {
            setSavedAt(new Date(parsed.savedAt));
          }
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, [draftKey, enabled]);

  const saveDraft = useCallback(
    (data: T) => {
      if (!enabled || typeof window === 'undefined') return;
      try {
        const payload: DraftWrapper<T> = {
          data,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(`draft_${draftKey}`, JSON.stringify(payload));
        setHasDraft(true);
        setSavedAt(new Date());
      } catch (e) {
        console.warn('Draft save quota warning', e);
      }
    },
    [draftKey, enabled]
  );

  const getDraft = useCallback((): T | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`draft_${draftKey}`);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftWrapper<T>;
        return parsed?.data || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`draft_${draftKey}`);
      setHasDraft(false);
      setSavedAt(null);
    } catch (e) {
      // Ignore
    }
  }, [draftKey]);

  return {
    hasDraft,
    savedAt,
    saveDraft,
    getDraft,
    clearDraft
  };
}

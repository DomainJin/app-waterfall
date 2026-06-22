import { useEffect } from 'react';
import { useTimelineStore } from '../../store/timeline';
import { isEditableTarget, type EditableTargetLike } from './keyboardShortcuts';

// Global transport shortcuts: Space = play/pause, Home = seek to 0. Skipped
// while focus is on a text-entry control (typing a number shouldn't toggle
// playback) — see isEditableTarget for exactly which elements count.
export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target as EditableTargetLike | null)) return;
      if (e.code === 'Space') {
        e.preventDefault(); // default is page scroll
        useTimelineStore.getState().toggle();
      } else if (e.code === 'Home') {
        e.preventDefault();
        useTimelineStore.getState().seek(0);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

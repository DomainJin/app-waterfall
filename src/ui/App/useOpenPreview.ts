import { useCallback } from 'react';
import { useUiStore } from '../../store/uiStore';

// Opens the preview window via the Electron IPC bridge and records the open.
export function useOpenPreview() {
  const registerPreviewOpen = useUiStore((s) => s.registerPreviewOpen);

  return useCallback(async () => {
    if (!window.electronAPI) {
      // Running in a plain browser (e.g. `vite` without Electron).
      console.warn('electronAPI unavailable — run via `npm run dev` (Electron).');
      return;
    }
    await window.electronAPI.openPreviewWindow();
    registerPreviewOpen();
  }, [registerPreviewOpen]);
}

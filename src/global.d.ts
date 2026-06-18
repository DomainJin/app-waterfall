// API surface exposed by electron/preload.js on the renderer's window.
export interface ElectronAPI {
  /** Ask the main process to open the preview window. */
  openPreviewWindow: () => Promise<boolean>;
}

declare global {
  interface Window {
    // Undefined when the renderer runs in a plain browser (no Electron).
    electronAPI?: ElectronAPI;
  }
}

export {};

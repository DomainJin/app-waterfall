// API surface exposed by electron/preload.js on the renderer's window.
export interface ElectronAPI {
  /** Ask the main process to open the preview window. */
  openPreviewWindow: () => Promise<boolean>;
}

/**
 * Messages pushed from the main window to the preview window. The preview is
 * a separate renderer (no shared Zustand, no <video> element), so the main
 * window pushes the ENTIRE precomputed valve grid (see computeFullGrid) as
 * one message whenever it's (re)built, plus a transport tick for the
 * playhead. The preview just indexes into the received grid — no per-row
 * streaming, no live video sampling on either side.
 */
export type PreviewMessage =
  | {
      type: 'grid';
      cols: number;
      rows: number;
      row_ms: number;
      margin: number;
      length_m: number;
      fall_time_ms: number;
      bits: Uint8Array;
    }
  | {
      type: 'transport';
      positionMs: number;
      isPlaying: boolean;
      durationMs: number;
    }
  | {
      // LED matrix only ever shows the CURRENT instant (no falling/history,
      // unlike the valve grid) — flat row-major R,G,B per cell, length =
      // rows*cols*3, re-sent live as the playhead moves.
      type: 'led';
      cols: number;
      rows: number;
      rgb: Uint8Array;
    };

export interface PreviewSync {
  pushToPreview: (payload: PreviewMessage) => void;
  onPreviewData: (cb: (payload: PreviewMessage) => void) => () => void;
  notifyMain: (msg: string) => void;
  onPreviewNotify: (cb: (msg: string) => void) => () => void;
}

declare global {
  interface Window {
    // Undefined when the renderer runs in a plain browser (no Electron).
    electronAPI?: ElectronAPI;
    previewSync?: PreviewSync;
  }
}

export {};

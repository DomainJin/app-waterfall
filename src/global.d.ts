// API surface exposed by electron/preload.js on the renderer's window.
export interface ElectronAPI {
  /** Ask the main process to open the preview window. */
  openPreviewWindow: () => Promise<boolean>;

  /** Real filesystem path for a File picked via <input type=file>. */
  getPathForFile: (file: File) => string;
  /** Absolute fs path -> file:// URL a <video>/<audio> element can load. */
  pathToFileUrl: (path: string) => string;

  /** Native "Save project as" dialog. Resolves to the chosen path, or null if cancelled. */
  showSaveProjectDialog: (defaultPath?: string | null) => Promise<string | null>;
  /** Native "Open project" dialog. Resolves to the chosen path, or null if cancelled. */
  showOpenProjectDialog: (defaultPath?: string | null) => Promise<string | null>;
  writeFile: (path: string, content: string) => Promise<boolean>;
  readFile: (path: string) => Promise<string>;
  /** Raw bytes (accepts a plain fs path OR a file:// URL) — for decodeAudioData,
   *  since fetch() can't load file:// URLs from the renderer. */
  readFileBinary: (pathOrFileUrl: string) => Promise<Uint8Array>;

  /** Native "choose a folder" dialog (Export All). Resolves to the chosen
   *  folder path, or null if cancelled. */
  chooseExportFolder: (defaultPath?: string | null) => Promise<string | null>;
  /** Writes multiple binary files into one folder (Export All). */
  writeFilesToFolder: (
    folder: string,
    files: { name: string; bytes: Uint8Array }[],
  ) => Promise<boolean>;
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
      // The LED is a single ceiling-mounted strip (1D, no matrix rows of
      // its own) whose colors are pre-computed for the WHOLE timeline from
      // the valve grid (LED_MODE_SPEC.md) — same row indexing as the
      // valve grid, just RGB (3 bytes) per cell instead of 1 bit. Pushed
      // once per recompute, like 'grid'; the preview indexes into it by
      // the current row itself (positionMs / row_ms), no live re-push.
      type: 'ledScript';
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

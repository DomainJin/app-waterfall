// Preload: the only bridge between the sandboxed renderer and the main
// process. Exposes a minimal, explicit API on window.electronAPI.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Ask the main process to open the preview window. */
  openPreviewWindow: () => ipcRenderer.invoke('open-preview-window'),
});

// Cross-window sync for the preview. Both windows run this preload; each uses
// only the side it needs (main window pushes, preview window receives/notifies).
contextBridge.exposeInMainWorld('previewSync', {
  /** Main window -> preview window (geometry / grid / transport). */
  pushToPreview: (payload) => ipcRenderer.send('preview:push', payload),
  /** Preview window subscribes to pushes. Returns an unsubscribe fn. */
  onPreviewData: (cb) => {
    const fn = (_e, p) => cb(p);
    ipcRenderer.on('preview:data', fn);
    return () => ipcRenderer.removeListener('preview:data', fn);
  },
  /** Preview window -> main window (e.g. "ready"). */
  notifyMain: (msg) => ipcRenderer.send('preview:notify', msg),
  /** Main window subscribes to preview notifications. Returns unsubscribe fn. */
  onPreviewNotify: (cb) => {
    const fn = (_e, m) => cb(m);
    ipcRenderer.on('preview:notify-fwd', fn);
    return () => ipcRenderer.removeListener('preview:notify-fwd', fn);
  },
});

// Preload: the only bridge between the sandboxed renderer and the main
// process. Exposes a minimal, explicit API on window.electronAPI.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Ask the main process to open the (blank, for now) preview window. */
  openPreviewWindow: () => ipcRenderer.invoke('open-preview-window'),
});

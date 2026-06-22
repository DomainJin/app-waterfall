// Preload: the only bridge between the sandboxed renderer and the main
// process. Exposes a minimal, explicit API on window.electronAPI.
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { pathToFileURL } = require('node:url');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Ask the main process to open the preview window. */
  openPreviewWindow: () => ipcRenderer.invoke('open-preview-window'),

  /** Real filesystem path for a File picked via <input type=file> (renderer-side, no IPC). */
  getPathForFile: (file) => webUtils.getPathForFile(file),
  /** Absolute fs path -> file:// URL a <video>/<audio> element can load. */
  pathToFileUrl: (path) => pathToFileURL(path).toString(),

  showSaveProjectDialog: (defaultPath) =>
    ipcRenderer.invoke('dialog:saveProject', defaultPath ?? null),
  showOpenProjectDialog: (defaultPath) =>
    ipcRenderer.invoke('dialog:openProject', defaultPath ?? null),
  writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  /** Raw bytes (accepts a plain fs path OR a file:// URL) — for decodeAudioData. */
  readFileBinary: (pathOrFileUrl) => ipcRenderer.invoke('fs:readFileBinary', pathOrFileUrl),

  /** Native "choose a folder" dialog — for Export All. */
  chooseExportFolder: (defaultPath) => ipcRenderer.invoke('dialog:chooseFolder', defaultPath ?? null),
  /** Writes multiple binary files into one folder (Export All). */
  writeFilesToFolder: (folder, files) => ipcRenderer.invoke('fs:writeFilesToFolder', folder, files),
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

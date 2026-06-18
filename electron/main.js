// Electron main process.
//  - Creates the main application window.
//  - Exposes an IPC channel ('open-preview-window') that opens a second
//    BrowserWindow. For Phase 1 this is just a blank window proving the
//    IPC path works; it will become the physical-scale preview window.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// In dev, the renderer is served by Vite; in prod it's the built bundle.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const PRELOAD = path.join(__dirname, 'preload.js');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let previewWindow = null;

function loadRenderer(win, hash) {
  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL + (hash ? `#${hash}` : ''));
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      hash: hash || undefined,
    });
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#111418',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(mainWindow, '');

  if (DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createPreviewWindow() {
  // Re-focus an existing preview window instead of opening duplicates.
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.focus();
    return;
  }

  previewWindow = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#0b0d10',
    title: 'Waterfall Designer — Preview',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Loads the renderer at the #preview route — blank placeholder for now.
  loadRenderer(previewWindow, 'preview');

  previewWindow.on('closed', () => {
    previewWindow = null;
  });
}

// IPC: renderer asks the main process to open the preview window.
ipcMain.handle('open-preview-window', () => {
  createPreviewWindow();
  return true;
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

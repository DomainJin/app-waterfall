// Electron main process.
//  - Creates the main application window.
//  - Exposes an IPC channel ('open-preview-window') that opens a second
//    BrowserWindow. For Phase 1 this is just a blank window proving the
//    IPC path works; it will become the physical-scale preview window.
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { fileURLToPath } = require('node:url');

const PROJECT_DIALOG_FILTERS = [
  { name: 'Waterfall Project', extensions: ['wfp', 'json'] },
];

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
      // Keep the rAF water loop running smoothly even when the preview is on a
      // second monitor / not focused (it stays synced to main-window playback).
      backgroundThrottling: false,
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

// IPC: project Save As / Open file pickers (native dialogs need the main process).
ipcMain.handle('dialog:saveProject', async (_e, defaultPath) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'project.wfp',
    filters: PROJECT_DIALOG_FILTERS,
  });
  return canceled || !filePath ? null : filePath;
});

ipcMain.handle('dialog:openProject', async (_e, defaultPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath || undefined,
    filters: PROJECT_DIALOG_FILTERS,
    properties: ['openFile'],
  });
  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

// Atomic write: write to a sibling .tmp file then rename over the target.
// fs.writeFile truncates-then-writes in place — a failure partway through
// (disk full, permission revoked mid-write) would otherwise destroy the
// previously-good file. rename() is atomic on the same volume, so the
// original is never touched until the new content is fully on disk.
ipcMain.handle('fs:writeFile', async (_e, filePath, content) => {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
  return true;
});

ipcMain.handle('fs:readFile', async (_e, filePath) => {
  return fs.readFile(filePath, 'utf-8');
});

// Native "choose a folder" dialog — for "Export All" (.bin + LED script into
// one destination), distinct from the project file pickers above.
ipcMain.handle('dialog:chooseFolder', async (_e, defaultPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'createDirectory'],
  });
  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

// Writes multiple binary files into one chosen folder (Export All). Each
// write is atomic for the same reason fs:writeFile is above.
ipcMain.handle('fs:writeFilesToFolder', async (_e, folder, files) => {
  for (const { name, bytes } of files) {
    const target = path.join(folder, name);
    const tmpPath = `${target}.tmp`;
    await fs.writeFile(tmpPath, Buffer.from(bytes));
    await fs.rename(tmpPath, target);
  }
  return true;
});

// Raw bytes for decodeAudioData (waveform) — fetch() can't load file:// URLs
// from the renderer (Chromium blocks cross-file:// fetch), so this is the
// only way to read a reopened project's file:// media source. Accepts a
// plain fs path OR a file:// URL (the renderer always has the latter for
// VideoSource.fromPath sources, see core/sources/VideoSource.ts).
ipcMain.handle('fs:readFileBinary', async (_e, pathOrFileUrl) => {
  const filePath = pathOrFileUrl.startsWith('file://') ? fileURLToPath(pathOrFileUrl) : pathOrFileUrl;
  return fs.readFile(filePath); // no encoding -> Buffer, arrives as Uint8Array in the renderer
});

// IPC relay between the two windows (separate renderer contexts, no shared
// state). Main window pushes geometry/grid/transport to the preview window;
// the preview window notifies the main window (e.g. "ready").
ipcMain.on('preview:push', (_e, payload) => {
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.webContents.send('preview:data', payload);
  }
});
ipcMain.on('preview:notify', (_e, msg) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('preview:notify-fwd', msg);
  }
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

// Dev launcher for Electron.
//
// This machine's shell sets ELECTRON_RUN_AS_NODE=1 globally, which makes the
// Electron binary execute main.js as plain Node (no GUI). cross-env can't
// reliably clear it, so we delete it here, then spawn Electron normally.
const { spawn } = require('node:child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;
env.VITE_DEV_SERVER_URL = env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

const child = spawn(electron, ['.'], { stdio: 'inherit', env });
child.on('close', (code) => process.exit(code ?? 0));

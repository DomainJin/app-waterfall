// Loads a real sample video, lets the LED layer sample it live, and
// screenshots BOTH the main window's LED editor matrix canvas AND the
// shared preview window (LED strip above the curtain) to confirm color
// shows up in both places. Temporary; deleted after this verification.
delete process.env.ELECTRON_RUN_AS_NODE;
process.env.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findPreviewWindow(mainWin) {
  return BrowserWindow.getAllWindows().find((w) => w.id !== mainWin.id);
}

async function main() {
  require(path.join(__dirname, 'electron', 'main.js'));
  await app.whenReady();
  await sleep(800);
  const win = BrowserWindow.getAllWindows()[0];

  const videoPath = path.join(__dirname, 'video', '2.mp4');
  const b64 = fs.readFileSync(videoPath).toString('base64');

  const loadResult = await win.webContents.executeJavaScript(`
    (async () => {
      const b64 = "${b64}";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], '2.mp4', { type: 'video/mp4' });
      const input = document.querySelector('input[type=file]');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'dispatched';
    })();
  `);
  console.log('[verify] file load:', loadResult);

  await sleep(2500); // let the video decode metadata + first frame sample

  const durationCheck = await win.webContents.executeJavaScript(`
    document.body.innerText.match(/duration[^\\n]*/i)?.[0] || 'no-duration-text-found'
  `);
  console.log('[verify] duration readout:', durationCheck);

  // Play briefly so the playhead moves off t=0 (which may be a black/fade-in
  // frame) and the LED layer samples something with actual color in it.
  await win.webContents.executeJavaScript(`document.querySelector('[title="Play"]')?.click();`);
  await sleep(500);
  await win.webContents.executeJavaScript(`document.querySelector('[title="Pause"]')?.click();`);
  await sleep(300);

  // Open the shared preview window.
  await win.webContents.executeJavaScript(`
    [...document.querySelectorAll('button')].find(b => /open preview/i.test(b.textContent || ''))?.click();
  `);
  await sleep(800);
  const preview = findPreviewWindow(win);
  console.log('[verify] preview window found:', !!preview);
  await sleep(1000); // let LED sample + push to preview

  // Scroll the LED editor panel into view, then screenshot the main window.
  const ledCanvasRect = await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('[data-panel="led-editor"]');
      if (!el) return null;
      el.scrollIntoView({ block: 'start' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })();
  `);
  console.log('[verify] led-editor panel rect (after scroll):', ledCanvasRect);
  await sleep(200);

  const mainImg = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '_verify_led_editor.png'), mainImg.toPNG());

  if (preview) {
    const previewImg = await preview.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '_verify_led_preview.png'), previewImg.toPNG());
  }

  console.log('[verify] DONE');
  app.quit();
}

main().catch((err) => {
  console.error(err);
  app.quit();
  process.exitCode = 1;
});

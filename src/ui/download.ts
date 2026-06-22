// Trigger a browser download of a binary buffer. Shared by every editor's
// "Export" button (valve .bin, LED script) so there's one download mechanism.
export function downloadBin(bin: Uint8Array, filename: string) {
  const blob = new Blob([bin as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

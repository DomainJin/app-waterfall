import './styles.css';

// Rendered in the second BrowserWindow (#preview route). Blank placeholder
// for now — becomes the physical-scale valve-water + LED preview later.
export function PreviewWindow() {
  return (
    <div className="preview">
      <div>
        <h2>Preview</h2>
        <p>Physical-scale valve + LED preview will render here.</p>
      </div>
    </div>
  );
}

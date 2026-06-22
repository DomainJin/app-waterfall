import { useProjectMenu } from './useProjectMenu';
import './styles.css';

// File Open/Save/Save As controls for the whole project (physical + valve +
// LED + audio + source settings). Logic lives in useProjectMenu /
// store/project — this just renders.
export function ProjectMenu() {
  const { fileName, busy, error, saveProject, saveProjectAs, openProject, clearError } =
    useProjectMenu();

  return (
    <div className="project-menu">
      <button type="button" className="btn btn--sm" onClick={openProject} disabled={busy} title="Open a saved project (.wfp)">
        Open…
      </button>
      <button type="button" className="btn btn--sm" onClick={saveProject} disabled={busy} title="Save to the current file, or prompt for one if none is open yet">
        Save
      </button>
      <button type="button" className="btn btn--sm" onClick={saveProjectAs} disabled={busy} title="Save to a new file">
        Save As…
      </button>
      <span className="project-menu__file">{fileName ?? 'Untitled project'}</span>
      {error && (
        <span className="project-menu__error" title="Click to dismiss" onClick={clearError}>
          {error}
        </span>
      )}
    </div>
  );
}

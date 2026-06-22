import { useEffect } from 'react';
import { useProjectStore } from '../../store/project';

// Reflects the currently open project in the OS window title bar — Electron
// syncs BrowserWindow's title to document.title by default, so this is the
// only place that needs to know about it.
export function useDocumentTitle() {
  const currentPath = useProjectStore((s) => s.currentPath);

  useEffect(() => {
    const name = currentPath ? currentPath.split(/[\\/]/).pop() : null;
    document.title = name ? `Waterfall Designer — ${name}` : 'Waterfall Designer';
  }, [currentPath]);
}

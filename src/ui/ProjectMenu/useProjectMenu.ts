import { useProjectStore } from '../../store/project';

// All state/handlers for the project Open/Save controls. The component just renders.
export function useProjectMenu() {
  const currentPath = useProjectStore((s) => s.currentPath);
  const busy = useProjectStore((s) => s.busy);
  const error = useProjectStore((s) => s.error);
  const saveProject = useProjectStore((s) => s.saveProject);
  const saveProjectAs = useProjectStore((s) => s.saveProjectAs);
  const openProject = useProjectStore((s) => s.openProject);
  const clearError = useProjectStore((s) => s.clearError);

  const fileName = currentPath ? currentPath.split(/[\\/]/).pop() ?? null : null;

  return {
    fileName,
    busy,
    error,
    saveProject,
    saveProjectAs,
    openProject,
    clearError,
  };
}

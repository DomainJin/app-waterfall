// Pure: parses + validates a saved project file's JSON text. No store/IPC
// access — callers (the project store) apply the result to Zustand state.
import { PROJECT_FILE_VERSION, type ProjectFile } from './types';

export class ProjectFileError extends Error {}

const REQUIRED_SECTIONS = [
  'physical',
  'device',
  'valve',
  'led',
  'audio',
  'sources',
] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parses + structurally validates project JSON. Throws ProjectFileError on
 *  anything malformed, unparsable, or from an unsupported file version. */
export function parseProjectFile(json: string): ProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new ProjectFileError(`Not a valid project file (bad JSON): ${String(err)}`);
  }

  if (!isPlainObject(raw)) {
    throw new ProjectFileError('Not a valid project file (root is not an object).');
  }
  if (raw.version !== PROJECT_FILE_VERSION) {
    throw new ProjectFileError(
      `Unsupported project file version: ${String(raw.version)} (expected ${PROJECT_FILE_VERSION}).`,
    );
  }
  for (const key of REQUIRED_SECTIONS) {
    if (!isPlainObject(raw[key])) {
      throw new ProjectFileError(`Not a valid project file (missing "${key}" section).`);
    }
  }

  return raw as unknown as ProjectFile;
}

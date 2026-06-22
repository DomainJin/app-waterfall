// Pure: builds a ProjectFile from plain data slices. No store/IPC access —
// callers (the project store) gather the slices from Zustand state.
import {
  PROJECT_FILE_VERSION,
  type ProjectAudio,
  type ProjectDevice,
  type ProjectFile,
  type ProjectLed,
  type ProjectPhysical,
  type ProjectSources,
  type ProjectValve,
} from './types';

export interface ProjectSnapshotInputs {
  physical: ProjectPhysical;
  device: ProjectDevice;
  valve: ProjectValve;
  led: ProjectLed;
  audio: ProjectAudio;
  sources: ProjectSources;
}

export function buildProjectFile(inputs: ProjectSnapshotInputs): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    physical: inputs.physical,
    device: inputs.device,
    valve: inputs.valve,
    led: inputs.led,
    audio: inputs.audio,
    sources: inputs.sources,
  };
}

export function serializeProjectFile(inputs: ProjectSnapshotInputs): string {
  return JSON.stringify(buildProjectFile(inputs), null, 2);
}

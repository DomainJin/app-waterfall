import { MasterClock } from '../../core/timeline';

// The single shared master clock. The rAF advancement loop lives inside it
// (decoupled from React). Other domains (e.g. sources) import this instance
// directly; the store below is just a React-facing projection. Default 10 s
// until a loaded video sets the real duration.
export const masterClock = new MasterClock({ durationMs: 10_000, fps: 30 });

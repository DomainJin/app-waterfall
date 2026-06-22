// Pure: decides whether a keydown's target is "typing" text, so global
// shortcuts (Space/Home) don't hijack it. Duck-typed (not `instanceof
// HTMLElement`) so it's testable without a DOM.
export interface EditableTargetLike {
  tagName: string;
  isContentEditable: boolean;
  type?: string;
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'number',
  'search',
  'email',
  'password',
  'tel',
  'url',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
]);

/** True only for elements where Space/Home should type/move-cursor instead
 *  of triggering a global shortcut. Deliberately NOT true for range/
 *  checkbox/select inputs — those have no conflicting use for Space, and a
 *  slider happening to have focus shouldn't block play/pause. */
export function isEditableTarget(target: EditableTargetLike | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target.tagName === 'INPUT') return TEXT_INPUT_TYPES.has(target.type ?? 'text');
  return false;
}

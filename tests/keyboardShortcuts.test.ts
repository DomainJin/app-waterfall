import { describe, expect, it } from 'vitest';
import { isEditableTarget } from '../src/ui/App/keyboardShortcuts';

describe('isEditableTarget', () => {
  it('null target -> false', () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it('contentEditable element -> true regardless of tag', () => {
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('textarea -> true', () => {
    expect(isEditableTarget({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
  });

  it('text-entry input types -> true', () => {
    for (const type of ['text', 'number', 'search', 'email', 'password', 'url']) {
      expect(isEditableTarget({ tagName: 'INPUT', isContentEditable: false, type })).toBe(true);
    }
  });

  it('an <input> with no type attribute defaults to text -> true (safe default)', () => {
    expect(isEditableTarget({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
  });

  it('range/checkbox/select-adjacent inputs -> false (shortcuts should still fire)', () => {
    expect(isEditableTarget({ tagName: 'INPUT', isContentEditable: false, type: 'range' })).toBe(false);
    expect(isEditableTarget({ tagName: 'INPUT', isContentEditable: false, type: 'checkbox' })).toBe(false);
    expect(isEditableTarget({ tagName: 'INPUT', isContentEditable: false, type: 'color' })).toBe(false);
  });

  it('a SELECT or BUTTON having focus does not block shortcuts', () => {
    expect(isEditableTarget({ tagName: 'SELECT', isContentEditable: false })).toBe(false);
    expect(isEditableTarget({ tagName: 'BUTTON', isContentEditable: false })).toBe(false);
  });

  it('a plain DIV (e.g. document.body) -> false', () => {
    expect(isEditableTarget({ tagName: 'BODY', isContentEditable: false })).toBe(false);
  });
});

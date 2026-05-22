export const SPACE_SUBMIT_GUESS_KEY = 'whereami.spaceSubmitGuessEnabled';
export const PREFERENCES_CHANGED_EVENT = 'whereami:preferences-changed';

export function isSpaceSubmitGuessEnabled() {
  return localStorage.getItem(SPACE_SUBMIT_GUESS_KEY) !== 'false';
}

export function setSpaceSubmitGuessEnabled(enabled) {
  localStorage.setItem(SPACE_SUBMIT_GUESS_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED_EVENT, {
    detail: { spaceSubmitGuessEnabled: enabled }
  }));
}

export function shouldIgnoreHotkeyTarget(target) {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return ['input', 'textarea', 'select', 'button'].includes(tag) || el.isContentEditable;
}

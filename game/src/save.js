// Vice Bay saves: one small JSON blob in localStorage — cash, the job the
// player is on, and the best cash ever held. The title screen offers to
// continue it. Nothing else is persisted; the city is rebuilt from the seed
// on every load.

const SAVE_KEY = 'vicebay-save-v1';

/** Loads the save, or null when there is none (or it is unreadable). */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 150,
      mission: typeof data.mission === 'number' ? data.mission : 0,
      bestCash: typeof data.bestCash === 'number' ? data.bestCash : 0,
    };
  } catch (e) {
    return null;
  }
}

/** Stores the save. Never throws (private mode, quota, or no storage). */
export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    // Saving is a nicety, never a crash.
  }
}

/** Clears the save. */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Silent.
  }
}

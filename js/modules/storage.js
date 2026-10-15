export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Storage full or blocked: let the app warn the user instead of failing silently.
    window.dispatchEvent(new CustomEvent('avp-storage-error', { detail: { key } }));
    return false;
  }
}

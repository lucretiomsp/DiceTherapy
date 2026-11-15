// localStorage that never throws (private mode, blocked storage).
export const loadPref = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
export const savePref = (key, v) => { try { localStorage.setItem(key, v); } catch (e) { /* storage blocked */ } };

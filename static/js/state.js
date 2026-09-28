// ============================================================
// STATE — one observable store plus a tiny event bus.
//
// Each slice has a single writer (see the table in CLAUDE.md); everyone
// else reads with getState() or reacts with subscribe(). Values are frozen
// when set, so a snapshot can't be mutated behind the store's back.
//
// Notifications are queued and flushed after the current patch: a
// subscriber that calls setState doesn't re-enter the one running, its
// patch is applied and announced right after. A throwing subscriber is
// logged and the others still run.
//
// Events (emit/on) are for signals that aren't state: "frame" (every
// animation frame, payload = the live projection), "transition:start",
// "transition:end", "language:changed". Listeners are plain callbacks in
// an array — the frame event fires 60 times a second.
// ============================================================
let store = Object.freeze({});
const subscribers = []; // { keys: Set | "*", fn }
const listeners = new Map(); // event → [fn]
const queue = [];
let flushing = false;

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function safely(fn, ...args) {
  try {
    fn(...args);
  } catch (error) {
    console.error(error);
  }
}

export function getState() {
  return store;
}

// Merges `patch` and notifies once, with the keys whose value changed
// (compared by identity: replace a slice, don't mutate it).
export function setState(patch) {
  queue.push(patch);
  if (flushing) return;
  flushing = true;
  try {
    while (queue.length) {
      const next = queue.shift();
      const changed = Object.keys(next).filter((key) => store[key] !== next[key]);
      if (!changed.length) continue;
      const previous = store;
      store = Object.freeze({ ...store, ...Object.fromEntries(changed.map((key) => [key, deepFreeze(next[key])])) });
      for (const { keys, fn } of [...subscribers]) {
        if (keys === "*" || changed.some((key) => keys.has(key))) safely(fn, store, previous, changed);
      }
    }
  } finally {
    flushing = false;
  }
}

// keys: an array of slice names, or "*" for every change. Returns the
// unsubscribe function.
export function subscribe(keys, fn) {
  const entry = { keys: keys === "*" ? "*" : new Set(keys), fn };
  subscribers.push(entry);
  return () => subscribers.splice(subscribers.indexOf(entry), 1);
}

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
  return () => listeners.get(event).splice(listeners.get(event).indexOf(fn), 1);
}

export function emit(event, payload) {
  const fns = listeners.get(event);
  if (fns) for (const fn of [...fns]) safely(fn, payload);
}

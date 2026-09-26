import { getState, setState } from "../state.js";

// The one writer of `busy`: true while a projection morph or a view change
// runs, so clicks meanwhile are ignored. Cleared in `finally` — an exception
// mid-animation used to leave the flag stuck and the whole UI locked.
setState({ busy: false });

export async function runExclusive(task) {
  if (getState().busy) return false;
  setState({ busy: true });
  try {
    await task();
  } finally {
    setState({ busy: false });
  }
  return true;
}

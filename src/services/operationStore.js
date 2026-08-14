/**
 * In-flight and completed operation registry, keyed by idempotency key.
 *
 * Two jobs:
 *   1. Collapse a repeated submission of the same operation into the same promise, so a
 *      double click or a re-render cannot start a second run.
 *   2. Let the result screen re-read a finished operation for status and retry.
 *
 * HONEST LIMITATION: this is module state in one browser tab. It is NOT a distributed lock.
 * Two tabs, two administrators, or a reload mid-flight can still race, and Drive happily
 * allows two folders with the same name. Execution narrows that window by revalidating
 * against live Drive immediately before writing and by re-checking for duplicates
 * afterwards, but it cannot close it. A real lock needs a server — Apps Script LockService
 * or a backend — which is the documented extension point.
 */

const inFlight = new Map();
const completed = new Map();

/** Longest a completed result is retained for retry/status. */
const RESULT_TTL_MS = 30 * 60 * 1000;

function prune(now) {
  for (const [key, entry] of completed) {
    if (now - entry.at > RESULT_TTL_MS) completed.delete(key);
  }
}

/**
 * Run `fn` at most once per key.
 *
 * A concurrent call with the same key joins the running promise instead of starting a
 * second execution. A call after completion returns the stored result untouched.
 */
export async function runExclusive(key, fn, { now = () => Date.now() } = {}) {
  prune(now());

  if (inFlight.has(key)) return inFlight.get(key);

  const finished = completed.get(key);
  if (finished) return finished.result;

  const promise = (async () => fn())();
  inFlight.set(key, promise);

  try {
    const result = await promise;
    completed.set(key, { result, at: now() });
    return result;
  } finally {
    inFlight.delete(key);
  }
}

export function isInFlight(key) {
  return inFlight.has(key);
}

/** Retrieve a finished operation's result, e.g. to show status after a re-render. */
export function getOperationResult(key) {
  return completed.get(key)?.result ?? null;
}

/**
 * Forget a completed operation so an explicit retry actually re-runs.
 * Retrying is safe because execution is idempotent: existing items are reused.
 */
export function clearOperation(key) {
  completed.delete(key);
}

/** Test hook: drop all state between cases. */
export function resetOperationStore() {
  inFlight.clear();
  completed.clear();
}

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/** Races `promise` against a timeout so a dropped connection that never
 * resolves or rejects can't hang a loading state forever. Doesn't cancel the
 * underlying request (the data layer doesn't thread an AbortSignal through
 * every call), but guarantees the UI always gets to move to an error state
 * within `ms`. Default 15s matches the brief's "10-20s max" for ordinary
 * requests; pass a longer `ms` for legitimately slow operations. */
export function withTimeout(promise, ms = 15000, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

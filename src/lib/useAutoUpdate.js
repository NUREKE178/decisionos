import { useEffect, useRef } from "./preact.js";

const VERSION_URL = "/api/version";
const CHECK_INTERVAL = 120000;

/** Polls a small serverless endpoint that reports the live deployment's git
 * commit SHA (set by Vercel's VERCEL_GIT_COMMIT_SHA at request time, so it's
 * always correct with zero build step). When the SHA changes from the one
 * seen on mount, the app was redeployed under the user -- reload so they
 * don't keep using stale JS against a backend that may have moved on.
 * Skips the reload while the user has a text field focused (same guard
 * pattern as the homepage demo's keyboard handler) so a background
 * deploy can't silently discard an unsaved keystroke; it just retries on
 * the next poll or the next window focus instead. */
export function useAutoUpdate() {
  const currentVersion = useRef(null);
  const reloading = useRef(false);

  useEffect(() => {
    let interval;

    const checkVersion = async () => {
      if (reloading.current) return;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return;
        const data = await res.json();
        if (!data.version) return;

        if (!currentVersion.current) {
          currentVersion.current = data.version;
          return;
        }

        if (currentVersion.current !== data.version) {
          const active = document.activeElement?.tagName;
          if (active === "INPUT" || active === "TEXTAREA") return; // retry next tick instead of yanking the page mid-edit

          reloading.current = true;
          if ("caches" in window) {
            try {
              const names = await caches.keys();
              await Promise.all(names.map((n) => caches.delete(n)));
            } catch {}
          }
          window.location.reload();
        }
      } catch {
        // offline, endpoint unavailable (e.g. local static dev server), or aborted -- skip this tick
      }
    };

    checkVersion();
    interval = setInterval(checkVersion, CHECK_INTERVAL);

    const handleFocus = () => checkVersion();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
}

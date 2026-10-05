import { useCallback, useEffect, useState } from "react";

export interface Settings {
  token: string;
  apiBaseUrl: string;
  theme: "light" | "dark";
  wsReconnectMs: number;
  pollIntervalMs: number;
}

const KEY = "shc.settings";

/**
 * Build-time default for the backend base URL, from `VITE_API_URL` (see
 * `.env.development` / `.env.production`). It only supplies the *default*:
 * anything persisted in `localStorage["shc.settings"]` still wins, so the
 * Settings page and the login screen can retarget a running build at another
 * backend without a rebuild.
 */
const envApiBaseUrl = (import.meta.env["VITE_API_URL"] as string | undefined)?.trim();

export const defaultSettings: Settings = {
  token: "",
  apiBaseUrl: envApiBaseUrl || "http://localhost:8000/api/v1",
  theme: "dark",
  wsReconnectMs: 3000,
  pollIntervalMs: 7000,
};

let cache: Settings | null = null;
const listeners = new Set<(s: Settings) => void>();

/**
 * Hosts on which authorisation is skipped, mirroring the backend's
 * `is_localhost()` in `backend/core/utils.py`.
 *
 * THE TWO LISTS MUST BE CHANGED TOGETHER. `shared/auth/localhost_hosts.json`
 * holds the entries they share, and `backend/tests/unit/test_frontend_alignment.py`
 * fails when they drift. This file does not import that JSON at runtime: the
 * Vite build cannot reach outside this repository, which is why the artifact is
 * test-enforced rather than import-enforced (see `shared/auth/README.md`).
 *
 * `0.0.0.0` (the wildcard bind address) and `testserver` (Starlette
 * TestClient's default `Host`) are backend-only and deliberately absent: a
 * browser never reports either, and matching them here would only produce a
 * spurious login screen.
 */
const LOCALHOST_EXACT_HOSTS = ["localhost", "127.0.0.1", "::1"];
const LOCALHOST_SUFFIXES = [".local", ".lovable.app"];

/**
 * Local cluster or Lovable preview: authorisation is skipped entirely.
 *
 * The hostname is normalised before matching, exactly as the backend does, so
 * both spellings of IPv6 loopback resolve to the one canonical entry. A browser
 * reports `"[::1]"` (`new URL("http://[::1]:5173/").hostname`), while Starlette
 * strips the brackets and hands the backend `"::1"` - so the canonical entries
 * above are bracket-free and lowercase, and `MyHost.LOCAL` matches too.
 */
export function isLocalhost() {
  if (typeof window === "undefined") return false;
  const raw = window.location.hostname.trim().toLowerCase();
  const h = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  return LOCALHOST_EXACT_HOSTS.includes(h) || LOCALHOST_SUFFIXES.some((s) => h.endsWith(s));
}

export const LOCAL_TOKEN = "localhost-no-auth";

export function getSettings(): Settings {
  if (cache) return cache;
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw
      ? { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) }
      : defaultSettings;
  } catch {
    cache = defaultSettings;
  }
  if (!cache.token && isLocalhost()) cache = { ...cache, token: LOCAL_TOKEN };
  return cache;
}

export function setSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch };
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    applyTheme(next.theme);
  }
  listeners.forEach((l) => l(next));
}

export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Settings hook. Returns defaults during SSR/first paint, then hydrates. */
export function useSettings() {
  const [settings, setState] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setState(s);
    applyTheme(s.theme);
    setReady(true);
    const l = (n: Settings) => setState({ ...n });
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => setSettings(patch), []);
  return { settings, update, ready };
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalhost } from "./settings";

/**
 * Issue #31: the frontend half of the localhost-bypass list.
 *
 * `isLocalhost()` had no test at all before this file, while its backend twin
 * `is_localhost()` decided whether authentication was skipped. The two had
 * drifted apart four ways - a missing IPv6 loopback entry on the backend, an
 * extra `.lovableproject.com` here, no case-normalisation here, and no bracket
 * normalisation on either side - and nothing reported it.
 *
 * The scenario numbers (T35-T48) match the backend's table in
 * `backend/tests/unit/test_utils.py`, so a divergence shows up as the SAME
 * scenario number disagreeing on the two sides. The two intentional exceptions
 * are T43/T44 (`0.0.0.0` and `testserver` are backend-only), asserted here so
 * the divergence is deliberate rather than accidental.
 *
 * `shared/auth/localhost_hosts.json` holds the entries the two sides share. It
 * is not imported here: this repository is a standalone git submodule and
 * `../shared/` does not exist in its own clone. `backend/tests/unit/
 * test_frontend_alignment.py` reads that artifact and this file's source from
 * the parent checkout, and fails if they drift.
 */

function stubHostname(hostname: string) {
  // `vi.stubGlobal` works because jsdom's `location` is configurable in this
  // environment, and `restoreMocks` does not undo a global stub - hence the
  // explicit teardown below.
  vi.stubGlobal("location", { hostname });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isLocalhost - accepted hosts", () => {
  it("T35: localhost", () => {
    stubHostname("localhost");
    expect(isLocalhost()).toBe(true);
  });

  it("T36: 127.0.0.1", () => {
    stubHostname("127.0.0.1");
    expect(isLocalhost()).toBe(true);
  });

  it("T37: IPv6 loopback, bracketed - the form a browser actually reports", () => {
    // `new URL("http://[::1]:5173/").hostname === "[::1]"`. The backend sees
    // the same request as "::1", because Starlette strips the brackets, so this
    // is the form that has to keep working for the two lists to mean the same
    // thing.
    stubHostname("[::1]");
    expect(isLocalhost()).toBe(true);
  });

  it("T38: IPv6 loopback, canonical bracket-free form - matches backend T3", () => {
    stubHostname("::1");
    expect(isLocalhost()).toBe(true);
  });

  it("T39: a .local mDNS host", () => {
    stubHostname("myhost.local");
    expect(isLocalhost()).toBe(true);
  });

  it("T40: a .lovable.app preview host", () => {
    stubHostname("preview.lovable.app");
    expect(isLocalhost()).toBe(true);
  });

  it("T41: case-insensitive - matches backend T15", () => {
    // The backend lowercases; this did not, so a mixed-case hostname got a
    // login screen here while the backend waved it through.
    stubHostname("MyHost.LOCAL");
    expect(isLocalhost()).toBe(true);
  });

  it("T41b: bracketed loopback survives normalisation to the same entry", () => {
    // Both spellings must reduce to the one canonical `::1` entry, not merely
    // both happen to match: that is what lets the two lists be compared.
    stubHostname("[::1]");
    const bracketed = isLocalhost();
    vi.unstubAllGlobals();
    stubHostname("::1");
    expect(bracketed).toBe(isLocalhost());
    expect(bracketed).toBe(true);
  });

  it("tolerates surrounding whitespace, as the backend does", () => {
    // RFC 7230 s3.2.4 lets a sender append optional whitespace to a field
    // value; the backend trims it, so the frontend must too or the two
    // disagree about the same request.
    stubHostname(" localhost ");
    expect(isLocalhost()).toBe(true);
  });
});

describe("isLocalhost - rejected hosts", () => {
  it("T42: preview.lovableproject.com - removed by issue #31, matches backend T9", () => {
    stubHostname("preview.lovableproject.com");
    expect(isLocalhost()).toBe(false);
  });

  it("T42b: any .lovableproject.com host, not just preview", () => {
    stubHostname("evil.lovableproject.com");
    expect(isLocalhost()).toBe(false);
  });

  it("T43: 0.0.0.0 is backend-only - matches backend T7", () => {
    // The backend keeps it as the wildcard BIND address. A browser only
    // reports it if it resolved it, where the cost of rejecting is a spurious
    // login screen.
    stubHostname("0.0.0.0");
    expect(isLocalhost()).toBe(false);
  });

  it("T44: testserver is backend-only - matches backend T8", () => {
    // Starlette TestClient's default Host. A browser never sends it.
    stubHostname("testserver");
    expect(isLocalhost()).toBe(false);
  });

  it("T45: localhost.evil.com - the suffix match is dot-anchored", () => {
    stubHostname("localhost.evil.com");
    expect(isLocalhost()).toBe(false);
  });

  it("T46: evil-localhost.com - the exact match is whole-string", () => {
    stubHostname("evil-localhost.com");
    expect(isLocalhost()).toBe(false);
  });

  it("T47: notlocal - the leading dot stops a bare suffix matching", () => {
    stubHostname("notlocal");
    expect(isLocalhost()).toBe(false);
  });

  it("documents that the suffix list is matched with a plain endsWith", () => {
    // `.local` ends with `.local`, so a bare suffix is accepted. Recorded so
    // the leading dot in the lists is a deliberate anchor rather than an
    // accident - it is what makes T47 (`notlocal`) fail.
    stubHostname(".local");
    expect(isLocalhost()).toBe(true);
  });

  it("does not prefix-match an exact entry", () => {
    stubHostname("127.0.0.1.evil.com");
    expect(isLocalhost()).toBe(false);
  });

  it("strips at most one bracket pair", () => {
    stubHostname("[[::1]]");
    expect(isLocalhost()).toBe(false);
  });

  it("T48: returns false when there is no window (SSR guard)", () => {
    // The guard that keeps the module importable during server rendering.
    vi.stubGlobal("window", undefined);
    expect(typeof window).toBe("undefined");
    expect(isLocalhost()).toBe(false);
  });
});

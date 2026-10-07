#!/usr/bin/env node
/**
 * `npm run lockfile:check` — asserts that `package-lock.json` resolves every platform
 * variant it claims to (issue #77).
 *
 * It reads the committed lockfile and, for every package that declares
 * `optionalDependencies`, checks that each declared **platform** variant actually has a
 * resolved entry in `packages`. A gap is an error; the script names every parent and
 * every missing variant, then exits 1.
 *
 * ## Why this has to exist
 *
 * Native toolchains — rollup, rolldown, esbuild, lightningcss, `@tailwindcss/oxide`,
 * `@oxc-parser` — ship one npm package per OS/CPU/libc and list them all under
 * `optionalDependencies`, so that each install takes only the one it can run. That makes
 * the lockfile the *only* place the full set is written down, and it makes the failure
 * mode silent:
 *
 * - `npm ci` exits **0** while installing no native binary at all. There is no warning.
 * - `npm install` does **not** repair it. npm treats an existing lockfile as authoritative,
 *   so a lockfile missing platform variants is not re-resolved, on any platform.
 * - Nothing complains until a build fails with `Cannot find module
 *   '@rollup/rollup-linux-x64-gnu'` — far from the commit that broke it.
 *
 * This lockfile sat in exactly that state for its whole life: **8 `win32` entries, 0
 * `linux`, 0 `darwin`**. Linux and macOS builds were broken; only Windows worked, because
 * Windows was the only platform present. It was not a regression from any one commit — no
 * commit that ever touched the lockfile had ever had the others.
 *
 * The corruption comes from npm rebuilding the lockfile *from an existing `node_modules`
 * tree* rather than resolving from the registry (npm/cli#4828). A tree missing the other
 * platforms yields a lockfile missing the other platforms, and the loss is invisible
 * because a platform's absence is a legitimate outcome. So the check has to be a
 * cross-check of the lockfile against itself, which is all this does.
 *
 * ## What it does and does not check
 *
 * It checks **internal consistency**: every platform variant a package declares must be
 * resolved. That is the defect, and it is decidable from the lockfile alone — no registry,
 * no network, no `node_modules`.
 *
 * It does **not** check that the resolved versions satisfy the declared ranges, that a
 * variant exists on the registry, or that any particular platform is installable *here*.
 * Presence in the lockfile is necessary but not sufficient for a working install: whether
 * `-musl` or `-arm64` actually lands on disk is npm's `os`/`cpu`/`libc` filtering at
 * install time, and that needs the matching host. Those are verified by running the gates
 * on that platform, not by reading this file.
 *
 * The vocabulary has one known blind spot, stated rather than papered over: a package that
 * is single-platform but carries **no** platform token in its name is not recognised as a
 * variant. `rollup`'s 27 `optionalDependencies` are 26 variants plus `fsevents`, which is
 * darwin-only and identified by an `os` field rather than by its name — so dropping
 * `fsevents` from the lockfile would not be caught here. Enumerating such packages by hand
 * is a list with no end, so the boundary is documented instead; it is one darwin-only
 * watcher, not a family that can truncate a platform.
 *
 * ## The fix, if it fires
 *
 * Do **not** run `npm install` — per the above it cannot repair a lockfile that already
 * exists, so it will report success and change nothing. Regenerate from a fully clean
 * tree, which is the only path that re-resolves:
 *
 *     rm -rf node_modules package-lock.json && npm install
 *
 * Deleting the lockfile *alone*, while `node_modules` survives, is the trap that produced
 * the original defect in reverse: npm then rebuilds the lockfile from that tree, so you
 * can end up with **zero** platform entries — breaking Windows as well as Linux. Both must
 * go.
 *
 * ## Exit codes
 *
 * `0` — every declared platform variant is resolved. `1` — otherwise, and specifically
 * including the cases where the lockfile cannot be read or has no `packages` map. Those
 * are deliberately *not* reported as success: a guard that cannot see the lockfile has not
 * verified anything, and "nothing was checked" is not "nothing is missing".
 *
 * A path argument is accepted so the negative control can be run without reverting the
 * working tree: `node scripts/check-lockfile-platforms.mjs <lockfile>`.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCKFILE = process.argv[2] ?? join(ROOT, "package-lock.json");

/**
 * The `optionalDependencies` name segments that mean "this package is platform-specific".
 *
 * These are the tokens npm's own families use as `-<os>-<cpu>[-<libc>]` suffixes
 * (`rollup-linux-x64-gnu`, `lightningcss-darwin-arm64`, `@tailwindcss/oxide-win32-x64-msvc`),
 * plus the `-wasm32-wasi` spelling and the `musl`/`gnu`/`msvc` libc tails, which appear as
 * segments of a name whose platform segment is already matched.
 *
 * A *count* of packages would be the wrong shape for this list. Adding a new platform
 * variant to an upstream tool is an ordinary dependency update that must leave this gate
 * green; what must turn it red is a variant being *dropped from the lockfile*, which is a
 * count-independent fact. So the list is a vocabulary of names, and new members are
 * added only when a real family appears that this does not recognise.
 */
const PLATFORM_SEGMENTS = new Set([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "gnu",
  "linux",
  "msvc",
  "musl",
  "netbsd",
  "openharmony",
  "openbsd",
  "sunos",
  "wasi",
  "wasm32",
  "win32",
  "windows",
]);

/** True when a dependency name is a platform-specific native binary rather than a library. */
function isPlatformVariant(name) {
  // The platform token may sit in the package's unscoped half (`@esbuild/win32-x64`) or
  // in its own (`rollup-linux-x64-gnu`), so split on both separators.
  const parts = name.split("/").pop().split("-");
  return parts.some((segment) => PLATFORM_SEGMENTS.has(segment));
}

/** `node_modules/@tailwindcss/node/node_modules/lightningcss` -> `node_modules/@tailwindcss/node/` */
function parentDir(key) {
  const index = key.lastIndexOf("node_modules/");
  return index < 0 ? "" : key.slice(0, index);
}

function die(lines) {
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(1);
}

let lock;
try {
  lock = JSON.parse(readFileSync(LOCKFILE, "utf8"));
} catch (cause) {
  die([
    `lockfile:check: cannot read ${LOCKFILE}: ${cause.message}`,
    "  A guard that cannot see the lockfile must not report the lockfile as complete.",
  ]);
}

const packages = lock?.packages;
if (!packages || typeof packages !== "object") {
  die([
    `lockfile:check: ${LOCKFILE} has no "packages" map.`,
    "  Refusing to report zero gaps here: that would mean 'nothing was checked', not",
    "  'nothing is missing'.",
  ]);
}

/**
 * Where a declared dependency can be resolved from: hoisted to the top level, or nested
 * under the parent's own directory. npm hoists aggressively, so the top-level key is the
 * common case and the nested key the one that matters for a package installed twice at
 * different versions (`lightningcss` 1.33.0 and the 1.32.0 under `@tailwindcss/node`).
 */
function isResolved(name, key) {
  // Lockfile keys are always `/`-separated regardless of host, so this concatenates
  // rather than going through `path.join` (which would emit `\` on Windows).
  return (
    packages["node_modules/" + name] !== undefined ||
    packages[parentDir(key) + "node_modules/" + name] !== undefined
  );
}

const gaps = [];
let checkedParents = 0;
let declaredVariants = 0;

for (const [key, entry] of Object.entries(packages)) {
  const optional = entry?.optionalDependencies;
  if (!optional || typeof optional !== "object") continue;

  const variants = Object.keys(optional).filter(isPlatformVariant);
  if (variants.length === 0) continue;

  checkedParents++;
  declaredVariants += variants.length;

  const missing = variants.filter((name) => !isResolved(name, key));
  if (missing.length > 0) gaps.push({ key, version: entry.version, missing });
}

if (gaps.length > 0) {
  const missingTotal = gaps.reduce((sum, gap) => sum + gap.missing.length, 0);
  die([
    `lockfile:check: FAILED — ${missingTotal} platform variant(s) declared by ${gaps.length} package(s) are not resolved in the lockfile.`,
    "",
    ...gaps.flatMap((gap) => [
      `  ${gap.key}${gap.version ? ` @ ${gap.version}` : ""} declares ${gap.missing.length} variant(s) that are absent:`,
      ...gap.missing.map((name) => `    - ${name}`),
    ]),
    "",
    "  This is the defect issue #77 was filed for. On the platform those variants belong",
    "  to, `npm ci` exits 0 and installs nothing usable, and the build later fails with a",
    '  "Cannot find module" for one of these packages — with no warning in between.',
    "",
    "  `npm install` will NOT fix this: npm treats an existing lockfile as authoritative",
    "  and does not re-resolve it. Regenerate from a fully clean tree instead —",
    "",
    "      rm -rf node_modules package-lock.json && npm install",
    "",
    "  Delete both, not just the lockfile: with `node_modules` still present npm rebuilds",
    "  the lockfile from that tree and can drop the other platforms as well.",
  ]);
}

process.stdout.write(
  `lockfile:check: OK — all ${declaredVariants} platform variant(s) declared by ${checkedParents} package(s) are resolved in the lockfile.\n`,
);

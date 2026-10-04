#!/usr/bin/env node
/**
 * `npm run typecheck` — the frontend's only type gate (issue #39).
 *
 * It runs `tsc --noEmit -p tsconfig.json`, then holds the diagnostics against
 * an explicit, committed inventory in `scripts/typecheck-baseline.json`
 * instead of against a bare count.
 *
 * ## Why a script and not a count
 *
 * "Ignore the first N errors" cannot tell the two failures apart. A count of N
 * is satisfied by N *recorded* errors, and also by a recorded error that was
 * fixed plus an unrelated new one that happens to replace it. A ratchet that cannot
 * tell those apart is worse than none, because it looks like it is holding a line
 * while it is not. So the baseline is a multiset of exact `(file, code, message)`
 * triples and the gate demands an exact match in both directions:
 *
 *   - a diagnostic with no baseline entry  -> **surplus**  -> exit 1 (a new error)
 *   - a baseline entry no longer reported   -> **deficit**  -> exit 1 (it was fixed,
 *     or it moved; either way the file is stale and the ratchet has stopped ratcheting)
 *
 * Both are loud, and both name the offending entries.
 *
 * ## Why the file set is asserted too
 *
 * The ratchet above is an argument about *errors*, and it is blind to the other way this gate can
 * be defeated: shrink `tsconfig.json`'s `include`, and the files that left the program stop
 * reporting errors — which the baseline cannot distinguish from those errors having been *fixed*.
 * Drop the two `tests/integration/**` globs and the gate stays green while
 * `tests/integration/services.test.ts` — 19 tests — is silently unchecked again. That is precisely
 * the regression issue #39 exists to prevent, and a pure multiset comparison cannot see it.
 *
 * So the gate also asserts the program contains the files it is supposed to contain, using
 * `tsc --listFiles` from the same invocation as the diagnostics (one program, so the two cannot
 * disagree). The expectation is a list of **named sentinels**, not a count: adding a test file is
 * an ordinary change and must not turn the gate red, while any sentinel dropping out of the program
 * must. A sweep of every `*.test.ts` on disk under `src/`, `tests/integration/` and `tests/`
 * backs the named list up — deliberately reaching past `test.include`, so a test that nothing
 * runs is still named (see `SWEPT_ROOTS`) — so narrowing `include` to hand-picked paths cannot
 * quietly orphan a *new* test either.
 *
 * This check runs first and reads nothing from the baseline, so no baseline entry can mask a
 * missing file.
 *
 * ## Why line and column are recorded but not keyed on
 *
 * The line number of a pre-existing error is not part of its identity: inserting
 * an import above it moves it without changing anything about the defect. Keying
 * on the position would make the gate red on an unrelated edit, and a gate that
 * cries wolf is a gate people learn to bypass with `--force`-style habits. The
 * entries keep `line`/`column` so a human reading the baseline can find the code.
 *
 * ## Scope of the baseline
 *
 * Only production sources under `src/` are eligible. Test files (`*.test.*`,
 * `*.spec.*`, anything under `tests/`) and the config files are **not**: those
 * are genuinely type-clean, so a new error there fails with the baseline entirely
 * out of the picture.
 *
 * When the baseline no longer matches because errors were *fixed*, shrink
 * `scripts/typecheck-baseline.json` in the same commit. That shrink is the
 * ratchet turning.
 *
 * ## What the baseline holds, and what is not owed
 *
 * One entry, and it is a real production bug rather than type debt: the
 * `streamJobLogs` wrapper in `src/services/index.ts` is declared `async`, so it
 * hands back `Promise<Unsubscribe>` where `ClusterService.streamJobLogs` is
 * synchronous, and `src/routes/jobs.$jobId.tsx` calls it as an effect cleanup —
 * leaving a job page invokes a Promise and leaks the log WebSocket. Issue #39
 * declined it deliberately, because fixing it changes behaviour rather than types
 * and belongs in its own change; it is tracked in issue #45.
 *
 * The other 15 entries that used to be here were **one missing line**:
 * `src/services/types.ts` did not re-export the five types it imports from
 * `@/lib/types`, so they resolved to `any` inside `ClusterService` (5 × `TS2459`
 * at the import site) and every service return type became `any`, which is what
 * produced the 10 × `TS7006` implicit-`any` callback parameters in the route
 * components. One re-export removed all fifteen. So a `TS7006` in `src/routes/`
 * means a type is resolving to `any` further down — read
 * `scripts/typecheck-baseline.json`'s `$comment` before "fixing" the callback.
 *
 * ## Regenerating the baseline
 *
 * Never hand-write an entry: the comparison is exact, and a plausible-looking
 * entry that tsc does not actually print is indistinguishable from a stale one.
 * Regenerate from tsc's own output instead —
 *
 *     tsc --noEmit --pretty false -p tsconfig.json
 *
 * — and keep every line matching `<file>(<line>,<col>): error TS<code>: <message>`
 * whose file is a production `src/` source (`isRatchetable` above: any diagnostic
 * outside that set is a failure to fix, never to absorb). Record `file`, `line`,
 * `column`, `code` and `message` as printed, with `message` the text after the code
 * on that one line, whitespace-collapsed (`normalise`) — tsc wraps long messages
 * onto continuation lines, and the gate's `DIAGNOSTIC` pattern only reads the
 * first, so those continuations are not part of an entry. Keep `count` equal to
 * the array length and keep the `$comment` provenance up to date; the script
 * refuses to run if the two disagree.
 *
 * Then `npm run typecheck` is the acceptance test for the regeneration: it names
 * every surplus and every deficit, so a single wrong field is caught immediately.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "tsconfig.json";
const BASELINE = "scripts/typecheck-baseline.json";

/** `(file, line, column, code, message)` -> diagnostic. */
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

/**
 * Sentinels: files that must be in the program, by name. Anything on this list that
 * exists in the tree but not in the program fails the gate by name; anything on this
 * list that does *not* exist in the tree fails too, because an anchor that has been
 * renamed away or deleted is one whose coverage has silently lapsed — the same
 * discipline the deficit check enforces on the baseline.
 *
 * This is a named list, deliberately not a count: adding a test file is an ordinary
 * change that must leave the gate green, and a "the program must contain exactly N
 * test files" rule would go red on every one of them.
 *
 * The first six are also found by the sweep in `requiredFiles()`, so the duplication is
 * not a second source of truth to keep in step — it spells out the anchors so they stay
 * covered even if the sweep's globs are ever edited. `tests/e2e/**` is absent on
 * purpose: it is a separate program (`tsconfig.e2e.json`), see README.md#type-checking.
 */
const REQUIRED_FILES = [
  "src/hooks/useErrorHandler.test.ts",
  "src/lib/error-messages.test.ts",
  "src/lib/format.test.ts",
  "src/lib/profiles.test.ts",
  "src/services/http.test.ts",
  "src/services/index.test.ts",
  "tests/integration/services.test.ts",
  "vitest.config.ts",
  "vite.config.ts",
];

/**
 * The roots swept for test files. `src` and `tests/integration` mirror
 * `test.include` in `vitest.config.ts`, so a file found there is collected by
 * vitest *and* checked here. `tests` is swept wholesale and deliberately reaches
 * past `test.include`: vitest collects nothing under `tests/` outside
 * `tests/integration/`, so a test file there is run by nothing at all and this
 * program is the only thing that will ever look at it. That is worth a red — the
 * `tests` root exists so a new test directory cannot be added under it and quietly
 * skip every gate — but the reason it is named is "your test never runs", not
 * anything about vitest's configuration. `integration` is skipped by that root
 * because it is swept on its own line, to be named precisely, and `e2e` because it
 * is a separate program (`tsconfig.e2e.json`).
 */
const SWEPT_ROOTS = [
  { dir: "src", ignore: [], collectedBy: "vitest collects src/**/*.test.ts" },
  {
    dir: "tests/integration",
    ignore: [],
    collectedBy: "vitest collects tests/integration/**/*.test.ts",
  },
  {
    dir: "tests",
    ignore: ["integration", "e2e"],
    collectedBy:
      "nothing runs it — vitest's test.include stops at src/** and tests/integration/**, " +
      "so tsc here is the only coverage this file will ever get",
  },
];

/** Never descended into by the sweep: not ours, and full of foreign files. */
const SWEPT_IGNORED = new Set([
  "node_modules",
  "dist",
  ".output",
  ".vinxi",
  "playwright-report",
  "test-results",
]);

/** Windows paths are case-insensitive, so tsc's spelling is not ours to correct. */
const CASE_INSENSITIVE_FS = process.platform === "win32";

function die(lines) {
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(1);
}

/** True for files that must never be ratcheted: the baseline is not their excuse. */
function isTestFile(file) {
  const base = file.split("/").pop() ?? file;
  return (
    file === "tests" ||
    file.startsWith("tests/") ||
    /\.test\.tsx?$/.test(base) ||
    /\.spec\.tsx?$/.test(base)
  );
}

/** Only production sources under `src/` may be absorbed by the baseline. */
function isRatchetable(file) {
  return file.startsWith("src/") && !isTestFile(file);
}

/** Collapse the multi-line messages `tsc` wraps, so both sides compare equal. */
function normalise(message) {
  return message.replace(/\s+/g, " ").trim();
}

/** The identity of a diagnostic. Position deliberately excluded; see the header. */
function key({ file, code, message }) {
  return `${file}|${code}|${normalise(message)}`;
}

function position(entry) {
  const { line, column } = entry;
  return line == null ? "" : `:${line}:${column ?? 0}`;
}

/** `tsc --listFiles` prints absolute paths; this is how we compare them. */
function relativeToRoot(absolute) {
  const from = absolute.replace(/\\/g, "/");
  const root = ROOT.replace(/\\/g, "/");
  if (from.toLowerCase() === root.toLowerCase()) return "";
  if (!from.toLowerCase().startsWith(root.toLowerCase() + "/")) return null; // outside us
  return from.slice(root.length + 1);
}

/** Repo-relative paths of every `*.test.ts`/`*.test.tsx` under `dir`. */
function* walk(dir, ignore) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return; // no such directory — `REQUIRED_FILES` reports that if it was an anchor
  }
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SWEPT_IGNORED.has(entry.name) && !ignore.includes(entry.name))
        yield* walk(relative, ignore);
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      yield relative;
    }
  }
}

/**
 * Every file the program must contain: the named sentinels, plus every test file on
 * disk that vitest would collect. `file -> why it must be checked`.
 */
function requiredFiles() {
  // Sweep first, so a file vitest collects is explained by *that* when it is named in
  // the failure; `REQUIRED_FILES` only supplies the reason for the config anchors and
  // for anything the sweep cannot see.
  const required = new Map();
  for (const { dir, ignore, collectedBy } of SWEPT_ROOTS) {
    for (const file of walk(dir, ignore)) required.set(file, collectedBy);
  }
  for (const file of REQUIRED_FILES) {
    if (!required.has(file)) required.set(file, "required sentinel");
  }
  return required;
}

/** Membership in the file set `tsc --listFiles` reported. */
function inProgram(program, file) {
  return program.exact.has(file) || (CASE_INSENSITIVE_FS && program.folded.has(file.toLowerCase()));
}

/**
 * The file-set assertion. Independent of the baseline by construction: it reads the
 * tsc file list and the tree, nothing else.
 */
function assertFileSet(program) {
  if (program.exact.size === 0) {
    die([
      "typecheck: tsc --listFiles reported no files in the project at all.",
      "  Refusing to let the file-set assertion pass vacuously — the gate would be blind.",
      "  (tsc may be too old to support --listFiles, or the program may be empty.)",
    ]);
  }

  const missing = [];
  const gone = [];
  for (const [file, why] of requiredFiles()) {
    if (!existsSync(join(ROOT, file))) gone.push(file);
    else if (!inProgram(program, file)) missing.push([file, why]);
  }

  if (missing.length === 0 && gone.length === 0) return;

  const lines = [
    `typecheck: program file-set regression — ${missing.length + gone.length} anchor(s) are not covered by ${PROJECT}:`,
    ...missing.map(
      ([file, why]) =>
        `  ! ${file} is not in the TypeScript program — its types are NOT being checked (${why})`,
    ),
    ...gone.map(
      (file) =>
        `  ! ${file} is listed in REQUIRED_FILES but does not exist in the tree — the anchor it stood for is gone`,
    ),
    "  A file that is not in the program is not type-checked at all: vitest transpiles via esbuild,",
    "  which strips types without checking them, so a type error in it is invisible to every gate here.",
    "  Restore the matching `include` entry in " +
      PROJECT +
      " (see the 'Program scope' comment there), or — if the file was",
    "  renamed, moved or deleted on purpose — update REQUIRED_FILES in scripts/typecheck.mjs in the same commit.",
    "  A *.test.ts that nothing runs and nothing checks should be deleted, not left unclaimed.",
  ];
  die(lines);
}

function runTsc() {
  const tsc = join(ROOT, "node_modules", "typescript", "lib", "tsc.js");
  const result = spawnSync(
    process.execPath,
    // `--listFiles` rides along with the diagnostics rather than in a second run, so
    // the file set and the diagnostics provably describe one and the same program.
    [tsc, "--noEmit", "--pretty", "false", "--listFiles", "-p", PROJECT],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  if (result.error) die([`typecheck: could not run tsc: ${result.error.message}`]);

  // tsc exits 0 when clean and 2 when it reported diagnostics. Anything else is
  // a broken run, and treating it as "clean" would silently disable the gate.
  if (result.status !== 0 && result.status !== 2) {
    die([`typecheck: tsc exited ${result.status}`, (result.stdout || "").trim()]);
  }

  const diagnostics = [];
  const exact = new Set();
  const folded = new Set();
  for (const line of (result.stdout || "").split(/\r?\n/)) {
    const match = DIAGNOSTIC.exec(line);
    if (match) {
      const [, file, row, column, severity, code, message] = match;
      if (severity !== "error") continue;
      // tsc already prints paths relative to `cwd`, forward-slashed.
      diagnostics.push({
        file: file.replace(/\\/g, "/"),
        line: Number(row),
        column: Number(column),
        code,
        message: normalise(message),
      });
      continue;
    }
    // Not a diagnostic. `--listFiles` output is the only other thing on stdout, and it
    // is absolute (forward-slashed), which is what tells the two apart.
    const candidate = line.trim();
    if (!isAbsolute(candidate)) continue;
    const relative = relativeToRoot(candidate);
    if (relative === null) continue; // node_modules and anything else outside the project
    exact.add(relative);
    folded.add(relative.toLowerCase());
  }
  return { diagnostics, program: { exact, folded } };
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(join(ROOT, BASELINE), "utf8"));
} catch (cause) {
  die([`typecheck: cannot read ${BASELINE}: ${cause.message}`]);
}

if (!Array.isArray(baseline.diagnostics)) {
  die([
    `typecheck: ${BASELINE} has no "diagnostics" array — refusing to treat that as an empty baseline.`,
  ]);
}
if (baseline.count !== undefined && baseline.count !== baseline.diagnostics.length) {
  die([
    `typecheck: ${BASELINE} is inconsistent — "count" is ${baseline.count} but it lists ${baseline.diagnostics.length} diagnostics.`,
  ]);
}

const { diagnostics: actual, program } = runTsc();

// 0. The program must contain the files it is supposed to contain. Runs first, so a
//    shrunken file set is never reported as (or hidden behind) a clean diagnostic run.
assertFileSet(program);

// 1. Everything outside production `src/` must be clean, with no baseline involved.
const unbaselined = actual.filter((d) => !isRatchetable(d.file));

// 2. Production `src/` must match the baseline exactly, in both directions.
const expectedByKey = new Map();
for (const entry of baseline.diagnostics) {
  const k = key(entry);
  expectedByKey.set(k, [...(expectedByKey.get(k) ?? []), entry]);
}

const surplus = [];
for (const diagnostic of actual.filter((d) => isRatchetable(d.file))) {
  const k = key(diagnostic);
  const pool = expectedByKey.get(k);
  if (pool && pool.length > 0) pool.pop();
  else surplus.push(diagnostic);
}

const deficit = [...expectedByKey.values()].flat();

const failures = [];
if (surplus.length > 0) {
  failures.push(
    `typecheck: ${surplus.length} new type error(s) in src/ — the baseline has ${baseline.diagnostics.length} entries and does not cover these:`,
    ...surplus.map((d) => `  + ${d.file}${position(d)}: ${d.code}: ${d.message}`),
    "  Fix them, or — if they are a known debt — add exact entries to " + BASELINE + ".",
  );
}
if (deficit.length > 0) {
  failures.push(
    `typecheck: ${deficit.length} baselined error(s) are no longer reported — the baseline no longer matches the tree:`,
    ...deficit.map((d) => `  - ${d.file}${position(d)}: ${d.code}: ${d.message}`),
    "  Good news: they were fixed. Shrink " + BASELINE + " in this same commit.",
  );
}
if (unbaselined.length > 0) {
  failures.push(
    `typecheck: ${unbaselined.length} type error(s) outside the ratchet. These files are not baselined and must be clean:`,
    ...unbaselined.map((d) => `  ! ${d.file}${position(d)}: ${d.code}: ${d.message}`),
    "  (test files, config files and tests/e2e/** are never baselined)",
  );
}

if (failures.length > 0) die(failures);

const anchors = requiredFiles();
const testAnchors = [...anchors.keys()].filter((f) => /\.test\.tsx?$/.test(f)).length;

process.stdout.write(
  `typecheck: OK — 0 new errors. ${baseline.diagnostics.length} baselined src/ error(s) match ${BASELINE} exactly.\n` +
    `typecheck: file set OK — all ${anchors.size} anchor(s) are in the ${PROJECT} program (${testAnchors} vitest file(s) type-checked, no baseline involved).\n`,
);

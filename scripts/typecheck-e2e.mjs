#!/usr/bin/env node
/**
 * `npm run typecheck:e2e` — the Playwright program's type **report**, not a gate.
 *
 * It runs `tsc --noEmit -p tsconfig.e2e.json`, prints every diagnostic with its
 * file:line, and exits **0**.
 *
 * ## Why it reports instead of failing
 *
 * `tests/e2e/**` is deliberately not in `tsconfig.json` (issue #39, decision on
 * merging the two programs): Playwright drives the app in Node against a live
 * backend, not in the jsdom environment the vitest suite uses. It has 8 known
 * type errors, and this command was the only thing that could shrink them.
 *
 * It used to exit non-zero, permanently, for a cause that predates everyone who
 * runs it. That is a trap rather than a signal: the next person to wire an npm
 * script into CI by muscle memory inherits a red pipeline they did not cause, and
 * people route *around* red long before they route around missing — so the real
 * failure mode of a permanently-red target is not "someone is reminded", it is
 * "someone adds `--ignore-scripts` / `|| true` / a skipped step", and the 8 errors
 * then stop being visible to everyone rather than to one person.
 *
 * So the diagnostics are unchanged and still printed, and only the verdict is gone.
 * The number stays reproducible (printed on every run) and shrinkable (fix one,
 * re-run, watch it fall), and `npm run typecheck` remains the gate.
 *
 * ## The boundary this does not move
 *
 * **`npm run typecheck` still does not check `tests/e2e/**`, and exiting 0 here
 * changes nothing about that.** The gap is real and is the reason this script
 * exists: "the typecheck passes" still does not mean "everything is checked".
 * What changed is only that the size of the gap is reported rather than enforced.
 * `npm run typecheck` must keep calling `tests/e2e/**` a separate program — see
 * README.md#type-checking.
 *
 * ## Exit codes
 *
 * `0` whenever tsc ran, whatever it reported — including 0 errors. Non-zero only
 * when tsc itself could not run, or exited with something other than 0 or 2, which
 * is a broken invocation and not a type error. Treating that as success would
 * report "0 errors" for a program that was never checked.
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "tsconfig.e2e.json";

/** `(file, line, column, code, message)` -> diagnostic. Same shape as the main gate. */
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

const result = spawnSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "typescript", "lib", "tsc.js"),
    "--noEmit",
    "--pretty",
    "false",
    "-p",
    PROJECT,
  ],
  { cwd: ROOT, encoding: "utf8" },
);

if (result.error) {
  process.stderr.write(`typecheck:e2e: could not run tsc: ${result.error.message}\n`);
  process.exit(1);
}

// tsc exits 0 when clean and 2 when it reported diagnostics; both are this
// script's normal cases. Anything else is a broken run, and reporting "advisory,
// fine" for it would hide the fact that the program was never checked.
if (result.status !== 0 && result.status !== 2) {
  process.stderr.write(
    `typecheck:e2e: tsc exited ${result.status} — this is a broken run, not a type error\n` +
      (result.stdout || ""),
  );
  process.exit(1);
}

const stdout = result.stdout || "";

// tsc's own formatting already carries file(line,column) per diagnostic, including
// the wrapped continuation lines; reprinting it means the output cannot disagree
// with what `npx tsc -p tsconfig.e2e.json` prints.
if (stdout.trim() !== "") process.stdout.write(stdout);

const errors = stdout.split(/\r?\n/).filter((line) => {
  const match = DIAGNOSTIC.exec(line);
  return match !== null && match[4] === "error";
});

const note =
  errors.length === 0
    ? [
        "typecheck:e2e: 0 errors in tests/e2e/**.",
        "typecheck:e2e: the count recorded in tsconfig.e2e.json is stale — update it in this same commit.",
      ]
    : [
        `typecheck:e2e: ${errors.length} error(s) in tests/e2e/** — printed above, not gated.`,
        "typecheck:e2e: ADVISORY. This command exits 0 whatever it finds; it is a report, not a gate.",
        "typecheck:e2e: Those errors are known debt: issue #39 scoped itself to the main program and",
        "typecheck:e2e: declined them, so nothing is chasing them except whoever edits these specs.",
        "typecheck:e2e: They are NOT covered by `npm run typecheck` — tests/e2e/** is deliberately not",
        "typecheck:e2e: in tsconfig.json — so a green typecheck does not mean everything is checked.",
        "typecheck:e2e: That boundary is unchanged by this exit code; only the verdict is.",
        "typecheck:e2e: To shrink the number, fix one and re-run; if it changes, update the count in",
        "typecheck:e2e: tsconfig.e2e.json in the same commit.",
      ];

process.stdout.write(note.join("\n") + "\n");

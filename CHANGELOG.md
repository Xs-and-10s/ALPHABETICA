# Changelog

All notable changes to ALPHABETICA are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0-alpha.0] — 2026-04-19

### Added

- **Pluggable test reporters.** The runner now separates result collection
  from rendering. `run(tree, { reporter })` accepts one of four built-in
  reporter names or a custom `Reporter` object with `onRunStart`,
  `onSuiteEnter`, `onResult`, `onRunEnd` hooks. Built-ins:
    - `"pretty"` — Unicode checks/crosses with indentation (the default,
      unchanged from previous versions)
    - `"tap"` — TAP version 14 producer. CI-friendly.
    - `"junit"` — JUnit XML output consumable by Jenkins, GitLab CI,
      GitHub Actions.
    - `"null"` — emits nothing; useful for programmatic runs.
- **`RunOpts.write`** — configurable output sink. Defaults to
  `process.stdout.write`. Pass a string-accumulator for capture in tests.
- **Exports** for reporters: `prettyReporter`, `tapReporter`, `junitReporter`,
  `nullReporter` on the main namespace (`ALPHABETICA`) and as named exports.

### Changed

- **Internal runner refactor.** All `console.log` calls replaced with
  `reporter.on*` hooks. `opts.silent` still works — it now selects the
  null reporter. Backward-compatible for existing callers.

### Dogfooding notes

- The audit tool (`dogfood/audit.mjs`) gained a `--reporter=tap` flag. Same
  rule evaluation, now emits TAP for CI piping. Verified TAP output passes
  basic lint checks; JUnit XML validates against standard schema.

## [0.3.2-alpha.0] — 2026-04-19

### Added

- **`X(relation)` 1-arg form.** Counts facts of any arity with the given
  relation. Returns one empty substitution per match, so `Q(X("dep"))`
  reads naturally — no more inventing throwaway LVar names to count.
- **`E.lt` / `E.gt` / `E.le` / `E.ge`** comparison operators. Both 2-arg
  forms (`E.lt(3, 5) === true`) and curried forms (`E.lt(5)` returns
  `x => x < 5`, reading naturally as "less than 5"). Works on numbers,
  bigints, and strings. `WidenLiteral<T>` helper ensures the curried form
  accepts any value of the base type, not just the literal originally
  passed in.
- **`R(path, base)` caller-relative module loading.** A second string
  argument to `R` that matches `file://` / `https?://` is treated as a
  base URL, so relative paths resolve like they would in a top-level
  `import` from the caller's file. Use `R("./rules.mjs", import.meta.url)`.

### Dogfooding notes

- Rewrote the audit tool to exercise M, R, L/J, A-Attempt, T-tap,
  C-class, E comparisons, and Q(X(...)). Surfaced a **module resolution
  bug**: without a base URL, `R("./foo")` resolves relative to the
  ALPHABETICA module itself, not the caller — because dynamic `import()`
  resolves against the issuing module. Fixed by adding optional second
  argument (above). Lesson: any library that wraps `import()` for consumer
  use must expose the caller's `import.meta.url`.
- The audit tool loads rule modules (`rules/deps.mjs`, `rules/meta.mjs`),
  each exported as `M("RuleName", {...})` and introspected via
  `MODULE_NAME`/`MODULE_DOC`. This is the intended pattern for
  ALPHABETICA-native modules: plain ESM exports wrapping an `M()` value.
- `L("audit-done", ...)` + `J("audit-done", "halted")` works perfectly for
  `--fail-fast` early-exit. No stack unwind surprises.
- Writing the audit, I found no unresolved rough edges in this iteration.
  The 27-slot alphabet now covers real-world scripting well enough that a
  ~180-line auditor reads as a coherent program rather than a letter soup.

## [0.3.1-alpha.0] — 2026-04-19

### Added

- **`kbScope: "inherit"`** — a new runner option that skips all fresh-KB
  wrapping, so the test tree queries the caller's ambient knowledge base.
  Use when you've gathered facts in an outer `withKB` block and want your
  BDD assertions to run against them rather than a fresh empty KB.
  Discovered via dogfooding — the previous four values (given/state/when/
  then) all opened fresh scopes at *some* level, leaving no way to use
  facts asserted before the call to `run()`.

### Dogfooding notes

- Built `pkg-audit`, an npm package health auditor, using only ALPHABETICA
  primitives. Surfaced the missing `inherit` scope option on the first run
  (11 of 13 assertions failed because outer facts were invisible). After
  the fix, the tool runs cleanly on a real package and correctly reports
  issues on a deliberately malformed one (wildcard pins called out by name,
  missing docs flagged, etc.).

## [0.3.0-alpha.0] — 2026-04-19

### Added

- **Scrutinee narrowing in `B`.** Handlers now receive the narrowed scrutinee
  as a second argument. `B(v, [{ kind: "user" }, (_c, u) => u.name])` narrows
  `u` to the User variant of a User | Admin union. Structural patterns with
  discriminant keys narrow via `Extract<S, ...>`; type-guard predicates
  (`(v: unknown) => v is T`) narrow via their predicate output; wildcards,
  LVars, and regular predicates do not narrow.
- **`B.exhaustive(scrutinee, ...arms)`.** Compile-time exhaustiveness check.
  When arms don't cover the scrutinee type, the return becomes a poisoned
  type `{ __NON_EXHAUSTIVE__: "..."; uncoveredCases: ... }` that surfaces
  the missing variants when the caller tries to use the value. Same runtime
  as `B`.
- **Capture typing fix.** `ExtractCaptures<P, S>` now narrows `S` to the
  matching variant before extracting, so `{type: "click", x: _("x")}`
  against `Event = Click | Key` correctly types `x` as `number` (from Click)
  rather than `number | undefined` (from distribution over the union).

### Changed

- **`const` type parameters on B's per-arity overloads.** Required TS 5.0+.
  This prevents TS from widening literal types like `"click"` to `string`
  when they flow through tuple positions, which is what makes narrowing
  work end-to-end.
- **Pattern `P` passed to handler** is now the narrowed type, not the raw
  scrutinee. Purely a type-level change; runtime is unchanged.

### Test coverage

- 74 tests in `alphabetica.test.ts` (was 69), 73 in `alphabetica.test.mjs`.
- 7 new type-level cases in `exhaustive.test.ts`, including 2
  `@ts-expect-error` markers that verify the compile-time guard fires.

### Known limitations

- Scrutinee narrowing in `B` is 80/20: literal patterns, discriminated
  objects, type-guard predicates, and wildcards/LVars all narrow correctly.
  Array/tuple patterns and deeply nested conditional narrowing are not yet
  handled — `Narrow` returns the unnarrowed scrutinee in those cases rather
  than failing.
- `B.exhaustive` tops out at 8 arms. More arms fall back to plain `B`'s
  looser types (no exhaustiveness check). Extend via more overloads when
  needed.

## [0.2.0-alpha.0] — 2026-04-19

### The 27-slot alphabet

Each capital letter A–Z plus `_` maps to a small family of related utilities.
The single-letter style is the point: short enough to chain, broad enough to
cover testing, scripting, pattern matching, logic programming, and control
flow without a kitchen-sink API.

### Added

- **All 27 slots implemented** with overload-based discrimination — arity
  first, then first-argument type. `_` (wildcard / LVar / hole), A (Assert /
  Attempt / Apply), B (Branching / pattern match), C (Class / Compose), D (Do
  / Describe / Document), E (Equals / Examine), F (Fold / Facts), G (Given /
  Get), H (Hashmap / Has), I (Identity / If), J/L (Jump / Label), K (Constant),
  M (Module), N (Not / Negate / Never), O (Order), P (Pipe), Q (Quantity),
  R (Require / Refute / Read-Write-Append), S (Set / Solve), T (Then / Tap),
  U (Unfold / Until), V (Values), W (When / While), X (eXecute / eXamine),
  Y (Bounce / Trampoline), Z (Zip).
- **miniKanren-lite** via F (assert facts), S (solve conjunctions of goals),
  X (query shortcut), and `goal()` (build goals without asserting). Supports
  logic variables, structural unification, and multi-goal conjunctions.
- **Negation as failure** via `N(goal(...))` — produces a `NeverGoal` that
  succeeds inside `S([...])` iff the inner goal is unprovable under the
  current substitution.
- **BDD and xUnit test trees** via G/W/T (Gherkin-style) and D/E (describe /
  examine). Both tree shapes executed by `run(tree, opts?)`.
- **Scoped knowledge base** via `withKB(fn)` / `withKB(kb, fn)` / `scope()`
  built on Node's `AsyncLocalStorage` — survives async boundaries correctly.
- **Async auto-detection** on F (fold), W (while), U (until), and Y
  (trampoline): callbacks returning Promises switch the rest of the
  computation to async transparently.
- **Shell execution** via `X\`cmd\`` (bash, default), `X.zsh\`cmd\``,
  `X.sh\`cmd\``. Tagged-template interpolation auto-escapes values.
- **Pattern matching with capture inference** on B — LVars carry their names
  in types, so `B(v, [{name: _("n")}, ({n}) => ...])` correctly infers
  `n` as `string` when matched against `{name: string}`. Arity 1–8 in the
  primary overload set; more fall back to looser types.
- **Dynamic class construction** via `C(name, spec)` — produces a named class
  with a proper stack-trace identity (uses `new Function`; see security
  note).
- **Trampoline** via `Y` — correctly unwraps Y-wrapped functions on bounce
  so self-referential recursion via `Y.bounce(sum, ...)` does not grow the
  stack. Verified at 1,000,000 iterations.
- **Dual distribution**: `alphabetica.ts` (strict-typed, TS 5.x+) and
  `alphabetica.mjs` (no-build, vanilla Node 22+). Both 1:1 behaviorally.
- **Self-hosted test suite** using the library's own D/E/G/W/T primitives.
  69 tests in the TS suite, 70 in the JS suite, all passing.

### Security notes

- `C` with `spec` uses `new Function` internally to preserve class names
  in stack traces. Do not expose to untrusted input.
- `R` and `X` perform IO (file and shell). Intended for test runners,
  scripts, and sandboxed contexts — not user-facing web endpoints.

### Known limitations

- Scrutinee narrowing in B is not yet implemented — pattern `{kind: "user"}`
  matched against `User | Admin` captures correctly but does not narrow the
  scrutinee's type inside the handler. Planned for v0.3.
- Higher-kinded types are intentionally absent. Module (`M`) replaces the
  Functor/Monad slot from the design sketch.
- Node 22+ required for `AsyncLocalStorage.enterWith` and `Disposable`
  support. Bun and Deno should work but are not yet tested.

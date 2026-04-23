# Changelog

All notable changes to ALPHABETICA are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.5-alpha.0] — 2026-04-23

### Added — Test infrastructure

- **Type-level test suite** at `alphabetica.test-d.ts` using `expect-type`.
  21 assertions covering ExtractCaptures (7), Narrow (11), and targeted
  regressions (3) for the silent type bugs caught across 0.4.0–0.4.3:
  union-scrutinee capture weakening, SV distribution in IsCompatibleValue,
  and array exact-length exclusion of shorter/longer tuples. Executes
  entirely at `tsc --noEmit` time — zero runtime cost. Invoked via
  `npm run test:types`.
- **Property-based fuzz suite** at `alphabetica.fuzz.mjs` using `fast-check`.
  30 properties × 200 randomized runs = 6,000 test cases per full run,
  covering the highest-signal targets:
    - `B` pattern matcher (12 properties): literal match/mismatch, LVar
      capture, wildcard, array length exact-match — including a property
      locking in the 0.4.1 "silent length-mismatch" bug — rest capture,
      object pattern, predicate, first-arm-wins, nested two-level.
    - `S` unification (6 properties): query count correctness,
      X/S cross-consistency, determinism across repeated runs, bare `_`
      in goals (locking in the 0.4.3 bug), nonexistent relation returns
      empty, LVar-only queries return one sub per fact.
    - `F` fold (4 properties): addition-fold = sum, left-to-right order
      preservation on non-associative ops, empty-array returns seed,
      call-count invariance.
    - `Y` trampoline (4 properties): factorial equals iterative version,
      no stack overflow at 50k depth, identity preservation,
      non-bouncing return short-circuits.
    - `Z` zip (4 properties): output length = min of inputs, positional
      alignment, empty-with-anything is empty, 3-array zip bounded by
      shortest.
  Invoked via `npm run test:fuzz`.

### Added — devDependencies

- `expect-type@^1.3.0` — type-level assertions. Pure-TS, no runtime.
- `fast-check@^4.7.0` — property-based testing framework.

Zero production dependencies. Both tools run at test time only and don't
ship in the published tarball.

### Changed — Test orchestration

- The `test` script now runs the full chain: TS suite → exhaustive → JS/MJS
  suite → CJS smoke → type tests → fuzz suite. Full-green threshold is now
  98 TS + 7 exhaustive + 84 JS + CJS smoke + 21 type-level + 30 properties
  × 200 runs each = effectively ~6,200 total assertions verifying the
  library end-to-end on every test run.
- GitHub Actions CI now includes `test:types` and `test:fuzz` as separate
  named steps for failure visibility in the matrix.

### Regression coverage — lock-in summary

Every silent bug caught across 0.4.0–0.4.3 now has at least one property-
based test asserting the fix holds:

| Bug                                          | Version | Locked-in by              |
|----------------------------------------------|---------|---------------------------|
| Array length silent match                    | 0.4.1   | B prop #6 + Narrow test 21|
| SV distribution in IsCompatibleValue         | 0.4.2   | Narrow test 20            |
| Capture inference distributes-weakens        | 0.4.2   | Capture test 19           |
| Bare `_` fails to unify in `goal()` slots    | 0.4.3   | S prop #3                 |
| `C` private-method language-level constraint | 0.4.3   | Documented in README      |

## [0.4.4-alpha.0] — 2026-04-19

### Added

- **CommonJS distribution alongside ESM.** `require("@xs-and-10s/alphabetica")`
  now works in CJS consumers. Implementation:
    - New `tsconfig.cjs.json` compiles `alphabetica.ts` to `dist/cjs/alphabetica.js`
      as real CommonJS (`"use strict"`, `module.exports`, no ESM-interop shims
      beyond what `tsc` emits automatically).
    - `dist/cjs/package.json` with `{"type":"commonjs"}` overrides the
      outer `"type": "module"` so Node treats the `.js` output correctly.
    - `package.json` `exports` map now has a `require` condition pointing
      at the CJS build, alongside existing `import` and `types`.
    - `alphabetica.test.cjs` smoke test verifies `require()` succeeds,
      all 39 exports are present, and core runtime (B pattern match,
      F fold, S/X logic queries, bare `_` wildcards) works identically
      to the ESM build.
- **Continuous integration.** `.github/workflows/ci.yml` runs the full
  pipeline (`typecheck + test + build`) on every push and pull request
  across Node 20/22/24 × Ubuntu/macOS/Windows. Windows coverage in
  particular catches latent path-separator and shell-execution bugs that
  don't surface in local dev.

### Technical notes

- The TS source remains the **single source of truth for types and CJS**.
  `alphabetica.mjs` is still the hand-maintained ESM entry (kept as-is for
  zero-dep no-build consumers), and the CJS build is auto-generated — no
  drift possible between TS and CJS. Only the ESM hand-maintained twin
  could drift, and the existing test suite catches that (the JS suite runs
  independently against `.mjs`).
- Zero new production dependencies. The CJS build uses `tsc` alone.
- Package size: the CJS build adds ~30 KB uncompressed to the tarball;
  the `files` allowlist already included `dist/` so no files field change
  was needed.

## [0.4.3-alpha.0] — 2026-04-19

### Changed

- **`C("name", spec)` now uses the computed-property class-name pattern
  instead of `new Function()`** to build dynamically-named classes. No
  public API change, no behavior change for public methods, `static`,
  constructors, or `extends`. Benefits:
    - CSP-safe: no `unsafe-eval` required. Works in strict-CSP environments
      (browsers with CSP, service workers, Cloudflare Workers, Deno
      deploy, sandboxed iframes) where the previous `new Function` path
      would have failed at the first C call.
    - Minifier-transparent: the class body is literal JS, not a string.
      Source maps point into the real source; bundlers and tree-shakers
      can reason about it normally.
    - No runtime string compilation cost on first-call.

### Fixed

- **Bare `_` wildcard now unifies correctly in `goal()` slots.** Previously
  `S([goal("rel", _, _)])` silently returned zero matches because the
  unifier treated the wildcard function as an ordinary ground term and
  compared it with `Object.is` against the stored fact's values. Now
  `unifyOne` short-circuits to success (no binding) whenever either side
  carries the WILDCARD marker. This brings logic-query semantics in line
  with pattern-match semantics where `_` has always been "match anything,
  don't capture."

### Known limitations

- **`#privateMethod` in class specs is a language-level impossibility,
  not an implementation choice.** ECMAScript defines private names
  (`#foo`) as lexically scoped to a class body's source text. There is
  no `Object.defineProperty` analog for private names — you cannot add
  a `#foo` to a class after it has been declared. This applies to any
  spec-based class builder, not just `C`. Workarounds:
    - **Convention.** Use `_foo` for "intended-private" methods. Linters
      can enforce no-external-access.
    - **Closures.** Capture truly private state in a factory function;
      return the instance.
    - **`Symbol()` keys.** Unique-per-module symbols used as method keys
      give you non-enumerable, hard-to-access method identities without
      sacrificing the spec-object API.
  If privacy is a hard requirement, reach for a plain `class Foo {}`
  declaration — `C` is for when dynamic class naming from a variable
  matters more than privacy.

### Dogfooding notes

- The `_` wildcard unification fix surfaced from `cmdCheck` in the
  migration-runner dogfood silently reporting "0 applied migrations
  verified" when 3 were actually present. The `#privateMethod` collision
  surfaced on the first run — a parse error at module load, not silent
  runtime corruption — which prompted this CHANGELOG clarification about
  the language-level constraint and documented workarounds.

## [0.4.2-alpha.0] — 2026-04-19

### Changed — Narrow<P, S> restructure

- **Distribution over union members of S.** Narrow now iterates through each
  variant of the scrutinee and keeps the ones structurally compatible with
  the pattern. Previously, narrowing on some union shapes was silently
  imprecise. The new machinery is built from four helpers:
    - `DistributeNarrow<P, S>` — fires per S variant
    - `Compatible<P, S>` — structural fit check
    - `IsCompatibleValue<PV, SV>` — per-value compatibility, with
      `[SV] extends [object]` guard preventing unwanted SV-union distribution
    - `NarrowOne<P, S>` — recursively narrows matched variant's fields so
      nested patterns (e.g. `{tag:"A", inner:{kind:"user"}}`) narrow both
      levels
- **Element-level narrowing for array patterns.** `NarrowArray` now uses
  `ArrayCompatible` / `IsElementCompatible` to check positional literal
  compatibility, not just length. `["circle", _("r")]` against
  `["circle", number] | ["square", number, number] | ["text", string]`
  correctly narrows to the circle variant.
- **Filters variants missing the discriminant key.** Pattern `{kind: "ok"}`
  against `{kind:"ok"; data:number} | {kind:"err"; reason:string} | {type:"legacy"; v:number}`
  narrows to the OK variant only — the legacy variant (which has no `kind`
  key) is correctly excluded, not silently preserved.
- **Inlined `Arm<P, S, R>`** in all 8 `B` and 8 `B.exhaustive` overloads.
  `Arm` remains exported as a public type alias; the overloads write the
  tuple shape directly so per-arm inference stays independent.

### Fixed

- **Union-distribution bug in IsCompatibleValue and IsElementCompatible.**
  When a pattern value like `{kind:"user"}` was checked against a union
  scrutinee value like `{kind:"user"; name:string} | {kind:"admin"; perms:string[]}`,
  `SV extends object` distributed `SV`, yielding `true | false` = `boolean`
  instead of a single verdict. Wrapping with `[SV] extends [object]`
  prevents distribution and passes the union intact to `Compatible`,
  which handles it correctly via the standard mapped-type logic.

### Documentation

- **New README section: "Scrutinee variable gotcha".** Explains that
  TypeScript's control-flow narrowing on initialized variables can make
  `Narrow` produce surprising results at the call site. Shows the idiomatic
  pattern (function parameter or `declare const`) and the pitfall to avoid.
  Not library-specific — affects any generic call over a union — but worth
  documenting since it intersects directly with how users write `B` tests.

### Dogfooding notes

- The narrowing restructure was driven by a 6-case probe file testing real
  edge cases: array positional narrowing, object filtering of non-
  discriminant variants, and nested two-level narrowing. All 6 cases now
  pass. Three new tests added to the main suite cover the same shapes
  against real `B` calls with function-parameter scrutinees.
- Spent a full turn debugging what appeared to be a multi-arm inference
  bug (arm 2's handler receiving arm 1's narrowing). After extracting
  what TS inferred for P1/P2 via a spy type, confirmed both were correct.
  Traced the actual cause to TypeScript's control-flow narrowing on the
  test's `const m: Msg = {kind:"ok", ...}` initializer — the variable is
  already narrowed to the OK variant at the call site, so the Err arm
  correctly produces `never`. Not a library bug; it's now documented.

## [0.4.1-alpha.0] — 2026-04-19

### Added

- **Array / tuple patterns in `B`.** `[1, 2, 3]` matches exactly length-3
  arrays. Captures work positionally: `[_("a"), _("b")]` against `[10, 20]`
  binds `{a: 10, b: 20}`. Wildcards (`_`) and nested patterns (`{k: _("x")}`)
  work inside array positions.
- **`_.rest("name")`** — new rest-capture marker for array patterns. Captures
  the remaining elements as an array. Works at any position, not just the
  tail: `[_("first"), _.rest("mid"), _("last")]` against `[1,2,3,4,5]`
  binds `{first: 1, mid: [2,3,4], last: 5}`.
- **Tuple-length narrowing.** When a fixed-length pattern matches against a
  union of tuples of different lengths, the scrutinee narrows to the
  length-matching variant. Example: `[_("x"), _("y")]` against
  `[string] | [string, number] | [string, number, boolean]` narrows to the
  2-tuple variant inside the handler.

### Fixed

- **Array pattern length bug.** Previously, `B([1,2,3], [[1,2], () => ...])`
  silently matched because `Object.keys([1,2])` only enumerates `["0","1"]`,
  so the 3rd position was never compared. Length is now enforced exactly
  unless a `RestLVar` is present in the pattern.

### Dogfooding notes

- The bug above was caught by an early probe in the dogfood loop. Writing
  Case 2 of the probe (mismatched-length pattern) produced the wrong
  answer, which is how the fix landed. Array pattern support was added
  immediately after, exercising the same test harness.

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

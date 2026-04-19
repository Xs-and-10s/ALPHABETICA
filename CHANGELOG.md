# Changelog

All notable changes to ALPHABETICA are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

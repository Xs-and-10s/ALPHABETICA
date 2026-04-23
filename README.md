# ALPHABETICA

> 26 letters plus `_`, one per utility. Zero dependencies. Two distributions.

```js
import { A, B, D, E, F, G, N, S, T, V, W, X, Y, _, run, goal, withKB } from "@xs-and-10s/alphabetica";
```

ALPHABETICA is a combinator library where every capital letter is a function.
Pattern matching, BDD tests, miniKanren logic queries, shell scripting,
trampolines, and about twenty other combinators — one import, one mental model,
zero runtime dependencies. Strong TypeScript inference on pattern captures,
terse call sites, and about 36 KB compiled.

## 60-second pitch

Here's a realistic slice: classify a stream of events by kind, assert the
results as facts, then query them with logic programming. Six letters doing
what would normally take three separate libraries.

```js
import { _, B, F, P, Q, S, X, goal, withKB } from "@xs-and-10s/alphabetica";

const events = [
  { kind: "signup",   userId: "u1", email: "alice@example.com" },
  { kind: "login",    userId: "u1" },
  { kind: "purchase", userId: "u1", amountCents: 4900 },
  { kind: "purchase", userId: "u2", amountCents: 12900 },
  { kind: "error",    code: "E42", message: "db timeout" },
  { kind: "logout",   userId: "u1" },
];

// B: pattern-match with captures. Each arm narrows shape AND extracts fields.
const classify = (e) => B(e,
  [{ kind: "signup",   email: _("email") },          ({ email }) => ["new-user", email]],
  [{ kind: "login",    userId: _("u") },             ({ u })     => ["active",   u]],
  [{ kind: "purchase", amountCents: (n) => n >= 10000 },
                                                     (_c, e)     => ["big-sale", e.amountCents / 100]],
  [{ kind: "purchase", userId: _("u") },             ({ u })     => ["small-sale", u]],
  [{ kind: "error",    code: _("c"), message: _("m") },({ c, m })=> ["error", `${c}: ${m}`]],
  [_,                                                (_c, e)     => ["other", e.kind]],
);

withKB([], () => {
  // P: pipeline. F: fold, doubling as the fact-asserter.
  // One pass: classify each event, then record each classification as a fact.
  P((evs) => evs.map(classify),
    (tagged) => F(tagged, 0, (n, [tag, val]) => (F("classified", tag, val), n + 1)),
  )(events);

  // S + goal: query the knowledge base with unification.
  const bigSales = S([goal("classified", "big-sale", _("amount"))]);
  const errors   = S([goal("classified", "error",    _("msg"))]);

  console.log("Big sales:",   bigSales.map(s => `$${s.amount}`));    // ["$129"]
  console.log("Error count:", errors.length);                        // 1
  console.log("Total events:", Q(X("classified", _, _)));            // 6
});
```

Zero dependencies. Fully typed in TypeScript — `B`'s captures flow through
to handler parameters automatically. The pattern matcher, the fold, the
pipeline, the logic queries, and the wildcard all came from the same
import. Swap this for lodash + zod + a test framework and count the
dependency lines.

## Why ALPHABETICA?

**Use ALPHABETICA when:** you're writing a DevOps script, a build tool, a
test runner, a DSL, a code-golf exercise, or any small-to-medium utility
where pulling in lodash + zod + a logic library + a test framework feels
like overkill. ALPHABETICA is one import, zero runtime dependencies, and
about 36 KB compiled. All 27 slots share the same mental model: small
functions, terse names, composable behavior.

**Don't use ALPHABETICA when:** you're building a large application already
committed to specific ecosystems (React + Vitest + Zod). Those tools are
better at their individual jobs than ALPHABETICA is at any one of them.
ALPHABETICA's value is the *combination* — one coherent library that
covers most of what a small utility script needs.

A rough comparison:

- **vs. lodash:** lodash is excellent at a hundred things; ALPHABETICA is
  different at twenty-seven. Lodash has no pattern matching, no logic
  programming, no built-in test runner — different tool for different jobs.
- **vs. Zod:** Zod is a validation library with runtime schemas. ALPHABETICA
  has pattern matching, not schemas — it's not trying to replace Zod. Use
  Zod when you need JSON-in-the-wild validation; use `B` when you're
  already in-memory.
- **vs. Vitest/Jest:** they're much more featureful test runners. `D`/`E`/
  `G`/`W`/`T` are 80% of what a small library needs with zero extra config.
- **vs. a logic programming library:** ALPHABETICA's miniKanren is a small
  subset (no CLP, no tabling, no constraint propagation) — enough for
  querying in-memory facts, not enough for writing a theorem prover.

The honest version: ALPHABETICA trades feature depth for breadth and
consistency. If the breadth-for-depth trade fits your project, it'll feel
frictionless. If it doesn't, use the specialized alternatives.

## Install

```sh
npm install @xs-and-10s/alphabetica
# or bun add @xs-and-10s/alphabetica
```

Requires Node 22+ (AsyncLocalStorage, disposables, `Symbol.dispose`).

Works with both ESM and CommonJS consumers:

```js
// ESM
import { B, _ } from "@xs-and-10s/alphabetica";

// CommonJS
const { B, _ } = require("@xs-and-10s/alphabetica");
```

Node's exports-map resolution picks the right build automatically — ESM
consumers get the handwritten `alphabetica.mjs`, CJS consumers get the
auto-generated `dist/cjs/alphabetica.js`. Both expose the identical 27-slot
API.

## Two distributions, one API

The same import line works across runtimes:

```js
import { B, _ } from "@xs-and-10s/alphabetica";          // TS or bundler
import { B, _ } from "@xs-and-10s/alphabetica/ts";       // raw .ts for bundlers that prefer it
```

Node's exports-map resolution routes automatically: TypeScript projects
get the strongly-typed `.mjs` + `.d.ts`, CommonJS consumers get the
auto-generated `dist/cjs/alphabetica.js`, and the `/ts` subpath is raw
TypeScript source for bundlers that want to transpile in-place.

The TS and JS versions share identical runtime behavior. Pick the TS
entry when you want pattern-match capture inference; the JS entry is
there for zero-build-step projects.

## The 27 slots

| Letter | Meanings                                     | Discriminator                                      |
|--------|----------------------------------------------|----------------------------------------------------|
| `_`    | wildcard · LVar constructor · typed hole     | `_` bare · `_(name)` · `_()`                       |
| `A`    | Assert · Attempt · Apply                     | boolean · `() => R` · `(fn, ...args)`              |
| `B`    | Branching / pattern match                    | `B(scrutinee, ...[pattern, handler])`              |
| `C`    | Class · Compose (right-to-left)              | string 1st arg · all functions                     |
| `D`    | Do (IIFE) · Describe · Document              | fn-only · string+fn · string+value                 |
| `E`    | Equals (curried) · Examine                   | 1-arg · 2-arg · string+fn                          |
| `F`    | Fold-left · Fold-right · Facts (assert)      | array 1st · fn 1st · string 1st                    |
| `G`    | Given (BDD) · Get (path)                     | array 1st arg · object 1st arg                     |
| `H`    | Hashmap · Has                                | 1-arg · 2-arg                                      |
| `I`    | Identity · If                                | 1-arg · 3-arg                                      |
| `J`    | Jump (to Label)                              | `J(name, value?)`                                  |
| `K`    | Constant (thunk)                             | `K(x)()` → `x`                                     |
| `L`    | Label (catch-point for Jump)                 | `L(name, body)`                                    |
| `M`    | Module (frozen namespace + docs)             | `M(name, members, doc?)`                           |
| `N`    | Not · Negate · Never (anti-fact)             | boolean · fn · Fact                                |
| `O`    | Order (immutable sort)                       | `O(arr, cmp?|keyFn?)`                              |
| `P`    | Pipe (left-to-right)                         | `P(...fns)`                                        |
| `Q`    | Quantity (universal size)                    | string · array · Map · Set · object                |
| `R`    | Require · Refute · Read/Write/Append file    | bool · string · string+opts                        |
| `S`    | Set · Solve (miniKanren)                     | Iterable · `Fact[] | NeverGoal[]`                  |
| `T`    | Then (BDD) · Tap                             | string 1st · function 1st                          |
| `U`    | Unfold (lazy) · Until                        | fn 1st = Until · value 1st = Unfold                |
| `V`    | Values (let-in bindings)                     | `V(bindings, body)`                                |
| `W`    | When (BDD) · While                           | string 1st · function 1st                          |
| `X`    | eXecute shell (tagged template) · eXamine fact | tagged template · string 1st                     |
| `Y`    | Bounce (trampoline)                          | `Y(fn)` → trampolined fn                           |
| `Z`    | Zip                                          | `Z(arr1, arr2, ...)`                               |

## Quick tour

### Pattern matching with typed captures and narrowing

```ts
type User = { kind: "user"; name: string };
type Admin = { kind: "admin"; name: string; perms: readonly string[] };

const classify = (v: User | Admin) => B(v,
  [{ kind: "user" },  (_c, u) => `user ${u.name}`],
  //                       ^ narrowed to User
  [{ kind: "admin" }, (_c, a) => `admin ${a.name}, ${a.perms.length} perms`],
  //                       ^ narrowed to Admin
);
```

Each arm's handler receives two arguments: `captures` (any LVars in the
pattern) and the narrowed scrutinee. Both work together:

```ts
type Event =
  | { type: "click"; x: number; y: number }
  | { type: "key"; key: string };

const handle = (e: Event) => B(e,
  [{ type: "click", x: _("x") }, ({ x }, ev) => `click ${x},${ev.y}`],
  //                                ^ x: number   ^ ev: click variant
  [{ type: "key" }, (_c, ev) => `key ${ev.key}`],
);
```

Patterns narrow when they can:

| Pattern form                   | Narrowing behavior                        |
|--------------------------------|-------------------------------------------|
| Literal (`5`, `"red"`)         | Narrows S to that literal if S is a union |
| Discriminant object            | `Extract<S, {k: "v"}>` — standard variant |
| Fixed-length array `[p1, p2]`  | Narrows tuple union to matching length    |
| Type-guard `(v): v is T`       | `Extract<S, T>`                           |
| Regular predicate              | S (no narrowing)                          |
| Wildcard `_` / LVar `_("n")`   | S (captures but doesn't narrow)           |
| `_.rest("n")` inside array     | Captures remaining elements as array      |

### Array and tuple patterns

Array patterns match exactly by length unless a rest-capture is present.
Captures work positionally, and `_.rest("name")` can appear at any position:

```ts
import { B, _ } from "@xs-and-10s/alphabetica";

// Fixed length, positional captures
const sum = B([10, 20, 30] as const,
  [[_("a"), _("b"), _("c")], ({ a, b, c }) => a + b + c],
);
// sum === 60;  a: 10, b: 20, c: 30 at the type level

// Rest capture at the tail
B([1, 2, 3, 4, 5],
  [[_("head"), _.rest("tail")], ({ head, tail }) =>
    `${head} then ${tail.join(",")}`],
);
// "1 then 2,3,4,5"

// Rest in the middle
B([1, 2, 3, 4, 5],
  [[_("first"), _.rest("mid"), _("last")], ({ first, mid, last }) =>
    `${first}/${mid.length}/${last}`],
);
// "1/3/5"

// Length-discriminated tuple union narrows per arm
type LU = readonly [string] | readonly [string, number];
const f = (v: LU) => B(v,
  [[_("s")],          ({ s }) => s.length],             // s: string
  [[_("s"), _("n")],  ({ s, n }) => s.length + n],      // s: string, n: number
);
```

### Scrutinee variable gotcha

Narrowing depends on what TypeScript infers for the scrutinee at the call
site. TypeScript narrows variables based on their initializer via control
flow, so this initializes-then-calls pattern can surprise you:

```ts
type Msg = { kind: "ok"; data: number } | { kind: "err"; reason: string };

// ✗ TS narrows `m` to {kind:"ok", data:number} immediately,
// so arm 2's pattern has nothing to match and `v` becomes `never`.
const m: Msg = { kind: "ok", data: 42 };
B(m, [{ kind: "err" }, (_c, v) => v.reason /* v: never */]);
```

Prefer a function parameter or `declare const` to keep the scrutinee at
its declared union type:

```ts
// ✓ S is Msg inside classify's body; arms narrow per pattern
const classify = (m: Msg) => B(m,
  [{ kind: "ok" },  (_c, v) => v.data],            // v: ok variant
  [{ kind: "err" }, (_c, v) => v.reason.length],   // v: err variant
);
```

This isn't specific to `B` — it's how TypeScript narrows any generic call
over a union. If you see `v` surprise-typed as a single variant or `never`,
check whether the scrutinee was recently initialized from a literal.

### Exhaustiveness checking

Use `B.exhaustive` when you want the compiler to guarantee every case is
handled:

```ts
const classify = (v: User | Admin): string => B.exhaustive(v,
  [{ kind: "user" },  (_c, u) => u.name],
  [{ kind: "admin" }, (_c, a) => a.name],
);
// ✓ compiles

const incomplete = (v: User | Admin): string => B.exhaustive(v,
  [{ kind: "user" }, (_c, u) => u.name],
);
// ✗ Type '{ __NON_EXHAUSTIVE__: ...; uncoveredCases: Admin }'
//   is not assignable to type 'string'.
```

Exhaustiveness is enforced via the return type: if arms don't cover the
scrutinee, the return becomes a poisoned object whose `uncoveredCases` field
lists the missing variants. **Assign the return to a typed binding** or pass
it to a typed parameter for the error to surface.

At runtime `B.exhaustive` behaves exactly like `B` — the check is type-only.
Add a new variant to a union later and forget to handle it, and `tsc --noEmit`
catches it immediately.

**Requires TypeScript 5.0+** for `const` type parameters. The no-build
`alphabetica.mjs` version provides `B.exhaustive` as a runtime alias to `B`
without the compile-time guarantee.

### BDD tests with fixture injection

```ts
import { A, E, G, W, T, run } from "@xs-and-10s/alphabetica";

const suite = G(["Arithmetic",
  ["Positive operands", { a: 2, b: 3 },
    W("added",      T("sum is 5",     ({ a, b }: {a: number, b: number}) => A(E(a + b, 5)))),
    W("multiplied", T("product is 6", ({ a, b }: {a: number, b: number}) => A(E(a * b, 6)))),
  ],
]);

await run(suite);
// Given Arithmetic
//   Positive operands
//     When added
//         ✓ Then sum is 5  (0.1ms)
//     When multiplied
//         ✓ Then product is 6  (0.0ms)
// 2 passed, 0 failed, 0 skipped  (1.1ms)
```

### miniKanren with facts, queries, and anti-facts

```ts
import { F, S, N, X, _, goal, withKB } from "@xs-and-10s/alphabetica";

await withKB([], () => {
  F("parent", "alice", "bob");
  F("parent", "bob",   "carol");
  F("parent", "carol", "dan");

  // Who are alice's grandchildren?
  const grandkids = S([
    goal("parent", "alice", _("mid")),
    goal("parent", _("mid"), _("grand")),
  ]);
  // → [{ mid: "bob", grand: "carol" }]

  // Who are parents but NOT grandparents? (never-goal via N)
  const childless_parents = S([
    goal("parent", _("x"), _("y")),
    N(goal("parent", _("y"), _("z"))),
  ]);
  // → [{ x: "carol", y: "dan" }]
});
```

### Shell scripting

```ts
import { X, F, P } from "@xs-and-10s/alphabetica";

const files = await X`find . -name "*.ts" -type f`;
const count = P(
  (s: string) => s.trim().split("\n"),
  (lines: string[]) => lines.length,
)(files);

// Or mix shells:
const shellUser = await X.zsh`echo $SHELL`;
```

### Trampolined recursion

```ts
import { Y, type Bounce } from "@xs-and-10s/alphabetica";

const step = (n: number, acc: number): number | Bounce<[number, number]> =>
  n <= 0 ? acc : Y.bounce(sum, n - 1, acc + n);
const sum = Y<[number, number], number>(step);

sum(1_000_000, 0);  // 500_000_500_000 — no stack overflow
```

### Sync/async auto-detection

```ts
import { F, R } from "@xs-and-10s/alphabetica";

// Sync callback → sync result
const sum  = F([1, 2, 3], 0, (a, x) => a + x);      // number

// Async callback → Promise result, transparently
const sizes = await F(["a.ts", "b.ts"], 0,
  async (acc, f) => acc + (await R(f, "utf8")).length);
```

### Dynamic classes with `C`

`C("Name", spec)` builds a class whose `.name` is set to the string you
pass. Useful when the class name comes from config, a registry, or a
generated schema — situations where you'd otherwise have to sacrifice a
good name in stack traces.

```ts
const Report = C("Report", {
  constructor(dbPath) { this.dbPath = dbPath; this.entries = []; },
  methods: {
    record(entry) { this.entries.push(entry); },
    summary()     { return `${this.entries.length} entries from ${this.dbPath}`; },
  },
  static: {
    empty() { return new Report(""); },
  },
});

const r = new Report("/tmp/out.db");
r.record({ok: 1});
console.log(r.summary());          // "1 entries from /tmp/out.db"
console.log(Report.name);          // "Report"
```

`C` supports `constructor`, `methods`, `static`, and `extends`. Implemented
via the computed-property class-name pattern, so it works under strict CSP
(no `eval`, no `new Function`) and plays nicely with minifiers and source
maps.

**Private methods (`#foo`) aren't supported** — and this is a language
constraint, not a library one. ECMAScript requires private names to be
declared lexically inside a class body's source text; there's no way to
attach them to a class after declaration (no `Object.defineProperty`
analog exists for `#names`). If you need privacy, use `_foo` by
convention, capture state in a closure, or reach for a plain
`class Foo {}` declaration.

## Runner scopes

The runner opens a fresh knowledge base around each test by default. You can
widen that scope for tests that need to accumulate facts across multiple
`W`/`T` pairs:

```ts
await run(suite, { kbScope: "state" });   // KB shared within a state
await run(suite, { kbScope: "when" });    // KB shared within a when
await run(suite, { kbScope: "then" });    // default: fresh per assertion
await run(suite, { kbScope: "given" });   // KB shared across a whole given
```

Pass `{ silent: true }` to suppress output, `{ filter: path => ... }` to
run a subset of tests.

## Stability and SemVer

ALPHABETICA follows [Semantic Versioning](https://semver.org/). Once 1.0 is
cut, breaking changes will require a major version bump.

**Stable public API (1.0 promise):**

- All 27 slots (`A`–`Z` + `_`) with their documented call signatures
- `run`, `withKB`, `goal`
- The four reporters: `prettyReporter`, `tapReporter`, `junitReporter`,
  `nullReporter`
- The public type exports: `LVar`, `RestLVar`, `Fact`, `Pattern`,
  `KnowledgeBase`, `Substitution`, `TestNode`, `Module`, `ScopeGranularity`,
  `ReporterName`, `TestStatus`, `StateTuple`
- Symbols: `MODULE_NAME`, `MODULE_DOC`, `DOC`, `WILDCARD`, `BOUNCE`

**Internal, may change in any minor release:**

- Type-level helpers: `Narrow`, `ExtractCaptures`, `Compatible`, `NarrowOne`,
  `NarrowArray`, and other implementation-detail types
- Reporter construction internals (the exported `Reporter` interface is
  stable; how individual reporters compose output is not)
- The `Y_ORIGINAL` symbol (used internally to unwrap trampolined fns)
- The `/ts` subpath export (direct access to the raw TypeScript source)

If you depend on something not in the stable list, open an issue — we'll
either promote it to the stable surface or suggest a path forward.

## Roadmap

### Shipped

- [x] Pattern matching with typed captures (`B`) — 0.3.x
- [x] Exhaustiveness checking (`B.exhaustive`) — 0.3.x
- [x] Reporter abstraction (pretty, TAP, JUnit) — 0.4.0
- [x] CJS build for older toolchains — 0.4.4
- [x] GitHub Actions CI across Node 22/24 × Linux/macOS/Windows — 0.4.4
- [x] Type-level test suite + property-based fuzzing — 0.4.5
- [x] README rewrite with a compelling 60-second pitch — 0.5.0
- [x] **0.5.0: feature-complete, API-frozen, ready for external use**

### On the path to 1.0

- [ ] Sit period — 0.5.0 under external use, bug fixes only
- [ ] 1.0.0-rc.1 once 0.5.0 has held up
- [ ] 1.0.0 when the RC holds up without fixes

### Post-1.0 (tentative)

- [ ] Bun and Deno explicit support / CI
- [ ] Performance benchmarks against lodash / ramda / fp-ts equivalents
- [ ] A matching Zig port for performance-critical scripts

## License

MIT © Mark ([@Xs-and-10s](https://github.com/Xs-and-10s))

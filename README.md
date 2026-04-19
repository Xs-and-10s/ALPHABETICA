# ALPHABETICA

> 26 letters plus `_`, one per utility. Zero dependencies. Two distributions.

```js
import { A, B, D, E, F, G, N, S, T, V, W, X, Y, _, run, goal, withKB } from "@xs-and-10s/alphabetica";
```

ALPHABETICA is a single-letter combinator library designed for terse call
sites and strong TypeScript inference. The entire public API fits on one
keyboard row. It's built for:

- **Testing** — BDD (`G`/`W`/`T`) and xUnit (`D`/`E`) in the same file,
  with a built-in runner, fixture injection, and scoped knowledge bases.
- **DevOps scripting** — shell execution via tagged templates (`X\`cmd\``),
  file IO on `R`, deep recursion via `Y` (trampoline).
- **Logic programming** — miniKanren-lite with facts (`F`), negation-as-
  failure (`N`), unification, and multi-goal queries (`S`).
- **Code golf** — every utility has a one-character name.

It is **not** a general-purpose library for user-facing web apps: `C(name, spec)`
uses `new Function` for dynamic class construction, and `X` / `R` perform IO.
Use it in tests, build scripts, Web Workers, sandboxes, and places where
you control the inputs.

## Install

```sh
npm install @xs-and-10s/alphabetica
# or bun add @xs-and-10s/alphabetica
```

Requires Node 22+ (AsyncLocalStorage, disposables, `Symbol.dispose`).

## Two distributions, one API

```js
// TypeScript — superior inference, import from the package entry
import { B, _ } from "@xs-and-10s/alphabetica";

// JavaScript, no build step — same API
import { B, _ } from "@xs-and-10s/alphabetica";  // still works!

// Raw .ts source, if your bundler prefers it
import { B, _ } from "@xs-and-10s/alphabetica/ts";
```

The TS and JS versions share identical runtime behavior. Use the TS version
when you want pattern-match capture inference; use the JS version when you
need a zero-build-step dependency.

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
| Type-guard `(v): v is T`       | `Extract<S, T>`                           |
| Regular predicate              | S (no narrowing)                          |
| Wildcard `_` / LVar `_("n")`   | S (captures but doesn't narrow)           |

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

## Why?

Because the best utility libraries (lodash, ramda, remeda) optimize for
the reader of the call site, not the writer — and a single character is
hard to beat. The 27-slot constraint forces tight, coherent "zones of
meaning" per letter rather than infinite API surface.

It pairs especially well with:
- **Testing** where you want BDD and property-style assertions in the
  same tree, with no config and no extra dependencies.
- **Shell-style pipelines** where `P` and `C` replace most of what a
  `| ` operator would do.
- **Property-based invariants** expressed as miniKanren queries.

## Roadmap

- [ ] Scrutinee narrowing for `B` (exhaustiveness checking)
- [ ] Reporter abstraction for the runner (TAP, JUnit XML)
- [ ] CJS build for older toolchains
- [ ] Bun and Deno explicit support / CI

## License

MIT © Mark ([@Xs-and-10s](https://github.com/Xs-and-10s))

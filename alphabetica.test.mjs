// =============================================================================
// ALPHABETICA smoke test (no-build JS)
// =============================================================================
// Runs the JS port through the same 65 behaviors the TS test covers. Uses
// vanilla assertions so you can eyeball it without the test runner.
// =============================================================================

import {
  _, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
  run, withKB, goal, currentKB,
  MODULE_NAME, MODULE_DOC, DOC,
} from "./alphabetica.mjs";

function isPromise(x) { return !!x && typeof x.then === "function"; }

// -----------------------------------------------------------------------------
// xUnit suite: one describe per letter, examines inside
// -----------------------------------------------------------------------------

const xunit = D("ALPHABETICA (JS)", () => {

  D("_  wildcard / LVar / hole", () => {
    E("_ is callable as LVar constructor", () => {
      const v = _("x");
      A(v.__lvar);
      A(E(v.name, "x"));
    });
    E("_() with no args throws (typed hole)", () => {
      let threw = false;
      try { _(); } catch { threw = true; }
      A(threw);
    });
  });

  D("A  Assert | Attempt | Apply", () => {
    E("A(true) passes; A(false) throws", () => {
      A(true);
      let threw = false;
      try { A(false, "nope"); } catch { threw = true; }
      A(threw);
    });
    E("A(() => v) returns v (attempt form)", () => A(E(A(() => 42), 42)));
    E("A(fn, ...args) applies (apply form)", () => {
      const add = (a, b) => a + b;
      A(E(A(add, 2, 3), 5));
    });
  });

  D("B  Branching / pattern match", () => {
    E("literal pattern", () => {
      const r = B(5, [5, () => "five"], [_, () => "other"]);
      A(E(r, "five"));
    });
    E("LVar captures value", () => {
      const r = B({ name: "alice" },
        [{ name: _("n") }, ({ n }) => `hi ${n}`],
      );
      A(E(r, "hi alice"));
    });
    E("predicate pattern", () => {
      const classify = (x) => B(x,
        [(n) => n > 10, () => "big"],
        [(n) => n > 5, () => "medium"],
        [_, () => "small"],
      );
      A(E(classify(7), "medium"));
      A(E(classify(12), "big"));
      A(E(classify(2), "small"));
    });
    E("nested structural captures", () => {
      const v = { user: { name: "bob", age: 30 } };
      const r = B(v,
        [{ user: { name: _("n"), age: _("a") } },
          ({ n, a }) => `${n}-${a}`],
      );
      A(E(r, "bob-30"));
    });
    E("handler receives scrutinee as 2nd arg", () => {
      const classify = (v) => B(v,
        [{ kind: "user" },  (_c, u) => `user ${u.name}`],
        [{ kind: "admin" }, (_c, a) => `admin ${a.name}`],
      );
      A(E(classify({ kind: "user", name: "alice" }), "user alice"));
      A(E(classify({ kind: "admin", name: "bob" }), "admin bob"));
    });
    E("captures AND value together", () => {
      const handle = (e) => B(e,
        [{ type: "click", x: _("x") }, ({ x }, ev) => `click ${x},${ev.y}`],
        [{ type: "key" }, (_c, ev) => `key ${ev.key}`],
      );
      A(E(handle({ type: "click", x: 10, y: 20 }), "click 10,20"));
      A(E(handle({ type: "key", key: "a" }), "key a"));
    });
    E("B.exhaustive runs same as B", () => {
      const classify = (v) => B.exhaustive(v,
        [{ kind: "user" },  (_c, u) => `u:${u.name}`],
        [{ kind: "admin" }, (_c, a) => `a:${a.name}`],
      );
      A(E(classify({ kind: "user", name: "alice" }), "u:alice"));
      A(E(classify({ kind: "admin", name: "bob" }), "a:bob"));
    });
    E("array pattern: exact-length matches", () => {
      const r = B([1, 2, 3], [[1, 2, 3], () => "exact"], [_, () => "fell"]);
      A(E(r, "exact"));
    });
    E("array pattern: length mismatch does NOT match", () => {
      const r = B([1, 2, 3], [[1, 2], () => "wrong"], [_, () => "fell"]);
      A(E(r, "fell"));
    });
    E("array pattern: positional captures", () => {
      const r = B([10, 20, 30], [[_("a"), _("b"), _("c")], ({a,b,c}) => a+b+c]);
      A(E(r, 60));
    });
    E("array pattern: _.rest captures tail", () => {
      const r = B([1, 2, 3, 4, 5],
        [[_("h"), _.rest("t")], ({h, t}) => `${h}:${t.join(",")}`]);
      A(E(r, "1:2,3,4,5"));
    });
    E("array pattern: rest in middle", () => {
      const r = B([1, 2, 3, 4, 5],
        [[_("a"), _.rest("m"), _("b")], ({a, m, b}) => `${a}/${m.length}/${b}`]);
      A(E(r, "1/3/5"));
    });
    E("array pattern: empty rest", () => {
      const r = B([1, 9],
        [[_("a"), _.rest("m"), _("b")], ({a, m, b}) => `${a}/${m.length}/${b}`]);
      A(E(r, "1/0/9"));
    });
    E("array pattern: nested in object", () => {
      const r = B({coords: [10, 20]},
        [{coords: [_("x"), _("y")]}, ({x, y}) => `${x},${y}`]);
      A(E(r, "10,20"));
    });
  });

  D("C  Compose / Class", () => {
    E("C(f, g) = f ∘ g", () => {
      const inc = (n) => n + 1;
      const dbl = (n) => n * 2;
      A(E(C(inc, dbl)(3), 7));
    });
    E("C(name, spec) builds a class", () => {
      const Point = C("Point", {
        constructor(x, y) { this.x = x; this.y = y; },
        methods: { sum() { return this.x + this.y; } },
      });
      const p = new Point(3, 4);
      A(E(p.sum(), 7));
      A(E(Point.name, "Point"));
    });
  });

  D("D  Do / Describe / Document", () => {
    E("D(fn) is IIFE", () => A(E(D(() => 3), 3)));
    E("D(doc, value) attaches doc symbol", () => {
      const obj = D("a thing", { x: 1 });
      A(E(obj[DOC], "a thing"));
    });
  });

  D("E  Equals", () => {
    E("E(a,b) uses Object.is", () => {
      A(E(1, 1));
      A(N(E(1, 2)));
      A(E(NaN, NaN));
      A(N(E(0, -0)));
    });
    E("E(a) curries", () => {
      const isFive = E(5);
      A(isFive(5));
      A(N(isFive(6)));
    });
    E("E.lt / gt / le / ge", () => {
      A(E.lt(3, 5));
      A(E.gt(5, 3));
      A(E.le(5, 5));
      A(E.ge(5, 5));
      const lessThan5 = E.lt(5);
      A(lessThan5(3));
      A(N(lessThan5(5)));
    });
  });

  D("F  Fold / Facts", () => {
    E("foldLeft sums", () => {
      A(E(F([1, 2, 3, 4, 5], 0, (a, x) => a + x), 15));
    });
    E("foldRight builds a list", () => {
      const list = F((x, acc) => [x, ...acc], [], [1, 2, 3]);
      A(E(list.length, 3));
      A(E(list[0], 1));
      A(E(list[2], 3));
    });
    E("foldLeft direction (subtraction)", () => {
      A(E(F([1, 2, 3], 0, (a, x) => a - x), -6));
    });
    E("foldRight direction (subtraction)", () => {
      A(E(F((x, a) => x - a, 0, [1, 2, 3]), 2));
    });
  });

  D("G  Given / Get", () => {
    E("G(obj, path)", () => {
      const obj = { a: { b: { c: 42 } } };
      A(E(G(obj, "a.b.c"), 42));
      A(E(G(obj, "a.x.y"), undefined));
    });
  });

  D("H  Hashmap / Has", () => {
    E("H()", () => A(E(H().size, 0)));
    E("H(entries)", () => {
      const m = H([["a", 1], ["b", 2]]);
      A(E(m.get("a"), 1));
      A(E(m.size, 2));
    });
    E("H(obj)", () => A(E(H({ a: 1, b: 2 }).get("a"), 1)));
    E("H(obj, key)", () => {
      A(H({ a: 1 }, "a"));
      A(N(H({ a: 1 }, "b")));
    });
  });

  D("I  Identity / If", () => {
    E("I(x) = x", () => A(E(I(42), 42)));
    E("I(cond, a, b)", () => {
      A(E(I(true, "yes", "no"), "yes"));
      A(E(I(0, "yes", "no"), "no"));
    });
  });

  D("J / L  Jump / Label", () => {
    E("J jumps out of L", () => {
      const r = L("escape", () => {
        for (let i = 0; i < 100; i++) if (i === 7) J("escape", i);
        return -1;
      });
      A(E(r, 7));
    });
    E("J with non-matching label rethrows", () => {
      let caught = false;
      try {
        L("outer", () => L("inner", () => J("other", 0)));
      } catch { caught = true; }
      A(caught);
    });
  });

  D("K  Constant", () => {
    E("K(x)() = x", () => {
      const k = K("hello");
      A(E(k(), "hello"));
    });
  });

  D("M  Module", () => {
    E("M produces frozen namespace", () => {
      const Arith = M("Arith", {
        add: (a, b) => a + b,
        mul: (a, b) => a * b,
      }, "Basic arithmetic");
      A(E(Arith.add(2, 3), 5));
      A(E(Arith[MODULE_NAME], "Arith"));
      A(E(Arith[MODULE_DOC], "Basic arithmetic"));
      A(Object.isFrozen(Arith));
    });
  });

  D("N  Not / Negate", () => {
    E("N(bool)", () => {
      A(E(N(true), false));
      A(E(N(false), true));
    });
    E("N(predicate)", () => {
      const isEven = (n) => n % 2 === 0;
      const isOdd = N(isEven);
      A(isOdd(3));
      A(N(isOdd(4)));
    });
  });

  D("O  Order", () => {
    E("default sort is non-mutating", () => {
      const arr = [3, 1, 2];
      const sorted = O(arr);
      A(E(arr[0], 3));
      A(E(sorted[0], 1));
    });
    E("comparator form", () => {
      A(E(O([1, 2, 3], (a, b) => b - a)[0], 3));
    });
    E("key form", () => {
      const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
      A(E(O(items, (i) => i.n)[0].n, 1));
    });
  });

  D("P  Pipe", () => {
    E("P(f, g)(x) = g(f(x))", () => {
      const inc = (n) => n + 1;
      const dbl = (n) => n * 2;
      A(E(P(inc, dbl)(3), 8));
    });
    E("P and C are mirror images", () => {
      const inc = (n) => n + 1;
      const dbl = (n) => n * 2;
      A(E(P(inc, dbl)(3), C(dbl, inc)(3)));
    });
  });

  D("Q  Quantity", () => {
    E("Q(string)", () => A(E(Q("hello"), 5)));
    E("Q(array)", () => A(E(Q([1, 2, 3]), 3)));
    E("Q(Map)", () => A(E(Q(new Map([["a", 1]])), 1)));
    E("Q(Set)", () => A(E(Q(new Set([1, 2, 3])), 3)));
    E("Q(object)", () => A(E(Q({ a: 1, b: 2 }), 2)));
  });

  D("T  Then / Tap", () => {
    E("T(fn) taps", () => {
      let spied = 0;
      const tap = T((x) => { spied = x; });
      A(E(tap(42), 42));
      A(E(spied, 42));
    });
    E("T in a pipe", () => {
      let seen = 0;
      const f = P((n) => n + 1, T((n) => { seen = n; }));
      A(E(f(10), 11));
      A(E(seen, 11));
    });
  });

  D("U  Unfold / Until", () => {
    E("Unfold generates a sequence", () => {
      const ones = U(1, (n) => n > 5 ? null : [n, n + 1]);
      const arr = [...ones];
      A(E(arr.length, 5));
      A(E(arr[4], 5));
    });
    E("Until loops", () => {
      let i = 0;
      U(() => i >= 3, () => { i++; });
      A(E(i, 3));
    });
  });

  D("V  Values", () => {
    E("V threads bindings", () => {
      A(E(V({ x: 2, y: 3 }, ({ x, y }) => x * y), 6));
    });
    E("V returns body result", () => {
      const nodes = V({ n: 5 }, ({ n }) => [n, n * 2, n * 3]);
      A(E(nodes[2], 15));
    });
  });

  D("W  While", () => {
    E("While loops", () => {
      let i = 0, total = 0;
      W(() => i < 5, () => { total += i; i++; });
      A(E(i, 5));
      A(E(total, 10));
    });
  });

  D("Y  Bounce / Trampoline", () => {
    E("Y handles deep recursion", () => {
      const step = (n, acc) => n <= 0 ? acc : Y.bounce(sum, n - 1, acc + n);
      const sum = Y(step);
      A(E(sum(10_000, 0), 50_005_000));
    });
    E("Y works at 1M iterations", () => {
      const step = (n, acc) => n <= 0 ? acc : Y.bounce(sum, n - 1, acc + n);
      const sum = Y(step);
      A(E(sum(1_000_000, 0), 500_000_500_000));
    });
  });

  D("Z  Zip", () => {
    E("Z pairs two arrays", () => {
      const r = Z([1, 2, 3], ["a", "b"]);
      A(E(r.length, 2));
      A(E(r[0][0], 1));
      A(E(r[0][1], "a"));
    });
    E("Z handles three arrays", () => {
      const r = Z([1, 2], ["a", "b"], [true, false]);
      A(E(r.length, 2));
      A(E(r[0].length, 3));
    });
  });

  D("Logic programming", () => {
    E("X queries a single relation", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        const kids = X("parent", "alice", _("c"));
        A(E(kids.length, 1));
        A(E(kids[0].c, "bob"));
      });
    });
    E("X(rel) 1-arg counts facts", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        F("color", "red");
        A(E(Q(X("parent")), 2));
        A(E(Q(X("color")), 1));
        A(E(Q(X("none")), 0));
      });
    });
    E("S solves conjoined goals", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        const gps = S([
          goal("parent", "alice", _("mid")),
          goal("parent", _("mid"), _("grand")),
        ]);
        A(E(gps.length, 1));
        A(E(gps[0].mid, "bob"));
        A(E(gps[0].grand, "carol"));
      });
    });
    E("withKB isolates across scopes", () => {
      withKB([], () => { F("inner", "secret"); });
      const leak = X("inner", _("v"));
      A(E(leak.length, 0));
    });
  });

  D("Never (N as anti-fact)", () => {
    E("N(Fact) constructs NeverGoal", () => {
      const g = N(goal("color", "red"));
      A(E(g.__never, true));
    });
    E("never-goal excludes unifying solutions", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        F("parent", "carol", "dan");
        const results = S([
          goal("parent", _("x"), _("y")),
          N(goal("parent", _("y"), _("z"))),
        ]);
        A(E(results.length, 1));
        A(E(results[0].x, "carol"));
      });
    });
    E("never-goal with absent fact succeeds", () => {
      withKB([], () => {
        F("color", "red");
        F("color", "blue");
        const results = S([
          goal("color", _("c")),
          N(goal("color", "green")),
        ]);
        A(E(results.length, 2));
      });
    });
    E("never-goal with present fact rejects all", () => {
      withKB([], () => {
        F("color", "red");
        const results = S([
          goal("color", _("c")),
          N(goal("color", "red")),
        ]);
        A(E(results.length, 0));
      });
    });
  });

  D("Async detection", () => {
    E("sync fold returns sync value", () => {
      const r = F([1, 2, 3], 0, (a, x) => a + x);
      A(E(r, 6));
      A(!isPromise(r));
    });
    E("async fold returns Promise", async () => {
      const r = F([1, 2, 3], 0, async (a, x) => a + x);
      A(isPromise(r));
      A(E(await r, 6));
    });
    E("fold switches to async mid-iteration", async () => {
      const r = F([1, 2, 3, 4], 0, (a, x) =>
        x === 3 ? Promise.resolve(a + x) : a + x
      );
      A(isPromise(r));
      A(E(await r, 10));
    });
  });
});

// -----------------------------------------------------------------------------
// BDD suite
// -----------------------------------------------------------------------------

const bdd = G(["Arithmetic",
  ["Positive operands", { a: 2, b: 3 },
    W("added", T("sum equals 5", ({ a, b }) => A(E(a + b, 5)))),
    W("multiplied", T("product equals 6", ({ a, b }) => A(E(a * b, 6)))),
  ],
  ["Negative first operand", { a: -5, b: 3 },
    W("added", T("sum equals -2", ({ a, b }) => A(E(a + b, -2)))),
  ],
]);

const bddV = G(["Closure-bound fixtures",
  ["State using V", {},
    ...V({ x: 10, y: 20 }, ({ x, y }) => [
      W("sum", T("x + y = 30", () => A(E(x + y, 30)))),
      W("product", T("x * y = 200", () => A(E(x * y, 200)))),
    ]),
  ],
]);

const bddKB = G(["Accumulating facts across Whens",
  ["Single state, multi-when", {},
    W("assert first", T("one fact", () => {
      F("color", "red");
      A(E(X("color", _("c")).length, 1));
    })),
    W("assert second", T("two facts under state-scope", () => {
      F("color", "blue");
      A(E(X("color", _("c")).length, 2));
    })),
  ],
]);

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

const r1 = await run(xunit);
console.log("");
const r2 = await run(bdd);
console.log("");
const r3 = await run(bddV);
console.log("");
const r4 = await run(bddKB, { kbScope: "state" });

const totals = [r1, r2, r3, r4].reduce(
  (a, r) => ({
    passed: a.passed + r.passed,
    failed: a.failed + r.failed,
    skipped: a.skipped + r.skipped,
  }),
  { passed: 0, failed: 0, skipped: 0 },
);

console.log(`\n=============================================`);
console.log(`TOTAL: ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped`);
console.log(`=============================================`);

if (totals.failed > 0) process.exit(1);

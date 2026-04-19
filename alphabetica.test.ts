// =============================================================================
// ALPHABETICA self-hosted test suite
// =============================================================================
// Uses ALPHABETICA's own primitives (D/E for xUnit, A for assertions,
// G/W/T for a BDD example) to test every letter, every overload, and every
// async/scoping path.
// =============================================================================

import {
  _,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  I,
  J,
  K,
  L,
  M,
  N,
  O,
  P,
  Q,
  R,
  S,
  T,
  U,
  V,
  W,
  X,
  Y,
  Z,
  run,
  withKB,
  goal,
  currentKB,
  MODULE_NAME,
  MODULE_DOC,
  DOC,
  type Bounce,
} from "./alphabetica.ts";

// Local helper: structural Promise check that doesn't care about the
// type-level narrowing of its argument.
function isPromise(x: unknown): x is Promise<unknown> {
  return !!x && typeof (x as any).then === "function";
}

// -----------------------------------------------------------------------------
// xUnit suite: one describe per letter, examines inside
// -----------------------------------------------------------------------------

const xunit = D("ALPHABETICA", () => {
  D("_  wildcard / LVar / hole", () => {
    E("_ is callable as LVar constructor", () => {
      const v = _("x");
      A(v.__lvar);
      A(E(v.name, "x"));
    });
    E("_() with no args throws (typed hole)", () => {
      let threw = false;
      try {
        (_ as any)();
      } catch {
        threw = true;
      }
      A(threw);
    });
  });

  D("A  Assert | Attempt | Apply", () => {
    E("A(true) passes; A(false) throws", () => {
      A(true);
      let threw = false;
      try {
        A(false, "nope");
      } catch {
        threw = true;
      }
      A(threw);
    });
    E("A(() => v) returns v (attempt form)", () => {
      const r = A(() => 42);
      A(E(r, 42));
    });
    E("A(fn, ...args) applies (apply form)", () => {
      const add = (a: number, b: number) => a + b;
      A(E(A(add, 2, 3), 5));
    });
  });

  D("B  Branching / pattern match", () => {
    E("literal pattern", () => {
      const r = B(5, [5, () => "five"], [_, () => "other"]);
      A(E(r, "five"));
    });
    E("LVar captures value", () => {
      const r = B({ name: "alice" }, [{ name: _("n") }, ({ n }) => `hi ${n}`]);
      A(E(r, "hi alice"));
    });
    E("predicate pattern", () => {
      const classify = (x: number) =>
        B(
          x,
          [(n: number) => n > 10, () => "big"],
          [(n: number) => n > 5, () => "medium"],
          [_, () => "small"],
        );
      A(E(classify(7), "medium"));
      A(E(classify(12), "big"));
      A(E(classify(2), "small"));
    });
    E("nested structural captures", () => {
      const v = { user: { name: "bob", age: 30 } };
      const r = B(v, [
        { user: { name: _("n"), age: _("a") } },
        ({ n, a }) => `${n}-${a}`,
      ]);
      A(E(r, "bob-30"));
    });
    E("handler receives narrowed scrutinee as 2nd arg", () => {
      type User = { kind: "user"; name: string };
      type Admin = { kind: "admin"; name: string; perms: readonly string[] };
      const classify = (v: User | Admin) =>
        B(
          v,
          [{ kind: "user" }, (_c, u) => `user ${u.name}`],
          [{ kind: "admin" }, (_c, a) => `admin ${a.name} (${a.perms.length})`],
        );
      A(E(classify({ kind: "user", name: "alice" }), "user alice"));
      A(
        E(
          classify({ kind: "admin", name: "bob", perms: ["w", "r"] }),
          "admin bob (2)",
        ),
      );
    });
    E("captures AND narrowed value together", () => {
      type Event =
        | { type: "click"; x: number; y: number }
        | { type: "key"; key: string };
      const handle = (e: Event) =>
        B(
          e,
          [{ type: "click", x: _("x") }, ({ x }, ev) => `click ${x},${ev.y}`],
          [{ type: "key" }, (_c, ev) => `key ${ev.key}`],
        );
      A(E(handle({ type: "click", x: 10, y: 20 }), "click 10,20"));
      A(E(handle({ type: "key", key: "a" }), "key a"));
    });
    E("type-guard predicate narrows", () => {
      const isStr = (v: unknown): v is string => typeof v === "string";
      const r = B<
        string | number,
        /* a1 */ typeof isStr,
        string,
        /* a2 */ typeof _,
        string
      >(
        "hello" as string | number,
        [isStr, (_c, s) => `str(${s.length})`],
        [_, () => "other"],
      );
      A(E(r, "str(5)"));
    });
    E("B.exhaustive covers full union", () => {
      type User = { kind: "user"; name: string };
      type Admin = { kind: "admin"; name: string; perms: readonly string[] };
      const classify = (v: User | Admin) =>
        B.exhaustive(
          v,
          [{ kind: "user" }, (_c, u) => `u:${u.name}`],
          [{ kind: "admin" }, (_c, a) => `a:${a.name}`],
        );
      A(E(classify({ kind: "user", name: "alice" }), "u:alice"));
      A(E(classify({ kind: "admin", name: "bob", perms: [] }), "a:bob"));
    });
    E("B.exhaustive with wildcard default", () => {
      type Color = "red" | "green" | "blue";
      const name = (c: Color) =>
        B.exhaustive(
          c,
          ["red", () => "R"],
          ["green", () => "G"],
          ["blue", () => "B"],
        );
      A(E(name("red"), "R"));
      A(E(name("green"), "G"));
      A(E(name("blue"), "B"));
    });
  });

  D("C  Compose (right-to-left) / Class", () => {
    E("C(f, g) = f ∘ g", () => {
      const inc = (n: number) => n + 1;
      const dbl = (n: number) => n * 2;
      const f = C(inc, dbl); // inc(dbl(x))
      A(E(f(3), 7)); // dbl(3)=6, inc(6)=7
    });
    E("C(name, spec) builds a class", () => {
      const Point = C("Point", {
        constructor(this: any, x: number, y: number) {
          this.x = x;
          this.y = y;
        },
        methods: {
          sum(this: any) {
            return this.x + this.y;
          },
        },
      });
      const p = new (Point as any)(3, 4);
      A(E(p.sum(), 7));
      A(E((Point as any).name, "Point"));
    });
  });

  D("D  Do / Describe / Document", () => {
    E("D(fn) is IIFE", () => {
      const r = D(() => 1 + 2);
      A(E(r, 3));
    });
    E("D(doc, value) attaches doc symbol", () => {
      const obj = D("a thing", { x: 1 });
      A(E((obj as any)[DOC], "a thing"));
      A(E(obj.x, 1));
    });
  });

  D("E  Equals | Examine", () => {
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
    E("E.lt / gt / le / ge — 2-arg form", () => {
      A(E.lt(3, 5));
      A(N(E.lt(5, 3)));
      A(E.gt(5, 3));
      A(E.le(5, 5));
      A(E.ge(5, 5));
      A(N(E.lt(5, 5)));
      A(N(E.gt(5, 5)));
    });
    E("E.lt / gt / le / ge — curried form reads naturally", () => {
      const lessThan5 = E.lt(5);
      A(lessThan5(3)); // 3 < 5 ✓
      A(N(lessThan5(5)));
      const atLeast5 = E.ge(5);
      A(atLeast5(5));
      A(atLeast5(6));
      A(N(atLeast5(4)));
    });
    E("E comparisons work on strings and bigints", () => {
      A(E.lt("apple", "banana"));
      A(E.gt(10n, 5n));
    });
  });

  D("F  Fold / Facts", () => {
    E("foldLeft sums", () => {
      const sum = F([1, 2, 3, 4, 5], 0, (a, x) => a + x);
      A(E(sum, 15));
    });
    E("foldRight builds a list", () => {
      const list = F(
        (x: number, acc: number[]) => [x, ...acc],
        [] as number[],
        [1, 2, 3],
      );
      A(E(list.length, 3));
      A(E(list[0], 1));
      A(E(list[2], 3));
    });
    E("foldLeft is direction-sensitive (subtraction)", () => {
      // ((((0-1)-2)-3) = -6
      const r = F([1, 2, 3], 0, (a, x) => a - x);
      A(E(r, -6));
    });
    E("foldRight is direction-sensitive (subtraction)", () => {
      // 1-(2-(3-0)) = 2
      const r = F((x: number, a: number) => x - a, 0, [1, 2, 3]);
      A(E(r, 2));
    });
  });

  D("G  Given / Get (path)", () => {
    E("G(obj, path) safely reads nested props", () => {
      const obj = { a: { b: { c: 42 } } };
      A(E(G(obj, "a.b.c"), 42));
      A(E(G(obj, "a.x.y"), undefined));
    });
  });

  D("H  Hashmap / Has", () => {
    E("H() = empty Map", () => {
      const m = H();
      A(E(m.size, 0));
    });
    E("H(entries) builds Map", () => {
      const m = H([
        ["a", 1],
        ["b", 2],
      ] as const);
      A(E(m.get("a"), 1));
      A(E(m.size, 2));
    });
    E("H(obj) converts object", () => {
      const m = H({ a: 1, b: 2 });
      A(E(m.get("a"), 1));
    });
    E("H(obj, key) is hasOwnProperty", () => {
      A(H({ a: 1 }, "a"));
      A(N(H({ a: 1 }, "b")));
    });
  });

  D("I  Identity / If", () => {
    E("I(x) = x", () => {
      A(E(I(42), 42));
      const o = { a: 1 };
      A(E(I(o), o));
    });
    E("I(cond, a, b) ternary", () => {
      A(E(I(true, "yes", "no"), "yes"));
      A(E(I(0, "yes", "no"), "no"));
    });
  });

  D("J / L  Jump / Label", () => {
    E("J jumps out of L with a value", () => {
      const r = L<number>("escape", () => {
        for (let i = 0; i < 100; i++) {
          if (i === 7) J("escape", i);
        }
        return -1;
      });
      A(E(r, 7));
    });
    E("J with non-matching label rethrows", () => {
      let caught = false;
      try {
        L("outer", () => L("inner", () => J("other", 0)));
      } catch {
        caught = true;
      }
      A(caught);
    });
  });

  D("K  Constant", () => {
    E("K(x)() = x", () => {
      const k = K("hello");
      A(E(k(), "hello"));
      A(E(k(), "hello"));
    });
  });

  D("M  Module", () => {
    E("M(name, members, doc) produces frozen namespace", () => {
      const Arith = M(
        "Arith",
        {
          add: (a: number, b: number) => a + b,
          mul: (a: number, b: number) => a * b,
        },
        "Basic arithmetic",
      );
      A(E(Arith.add(2, 3), 5));
      A(E(Arith.mul(4, 5), 20));
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
    E("N(predicate) negates predicate", () => {
      const isEven = (n: number) => n % 2 === 0;
      const isOdd = N(isEven);
      A(isOdd(3));
      A(N(isOdd(4)));
    });
  });

  D("O  Order (immutable sort)", () => {
    E("default sort is non-mutating", () => {
      const arr = [3, 1, 2];
      const sorted = O(arr);
      A(E(arr[0], 3)); // original untouched
      A(E(sorted[0], 1));
      A(E(sorted[2], 3));
    });
    E("comparator form (arity 2)", () => {
      const sorted = O([1, 2, 3], (a, b) => b - a);
      A(E(sorted[0], 3));
    });
    E("key form (arity 1)", () => {
      const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
      const sorted = O(items, (i) => i.n);
      A(E(sorted[0]!.n, 1));
      A(E(sorted[2]!.n, 3));
    });
  });

  D("P  Pipe (left-to-right)", () => {
    E("P(f, g)(x) = g(f(x))", () => {
      const inc = (n: number) => n + 1;
      const dbl = (n: number) => n * 2;
      const f = P(inc, dbl); // dbl(inc(x))
      A(E(f(3), 8)); // inc(3)=4, dbl(4)=8
    });
    E("P and C are mirror images", () => {
      const inc = (n: number) => n + 1;
      const dbl = (n: number) => n * 2;
      A(E(P(inc, dbl)(3), C(dbl, inc)(3)));
    });
  });

  D("Q  Quantity", () => {
    E("Q(string)", () => {
      A(E(Q("hello"), 5));
    });
    E("Q(array)", () => {
      A(E(Q([1, 2, 3]), 3));
    });
    E("Q(Map)", () => {
      A(E(Q(new Map([["a", 1]])), 1));
    });
    E("Q(Set)", () => {
      A(E(Q(new Set([1, 2, 3])), 3));
    });
    E("Q(object)", () => {
      A(E(Q({ a: 1, b: 2 }), 2));
    });
  });

  D("T  Then / Tap", () => {
    E("T(fn) taps: returns input unchanged", () => {
      let spied = 0;
      const tap = T<number>((x) => {
        spied = x;
      });
      const r = tap(42);
      A(E(r, 42));
      A(E(spied, 42));
    });
    E("T in a pipe", () => {
      let seen = 0;
      const f = P<number, number, number>(
        (n) => n + 1,
        T<number>((n) => {
          seen = n;
        }),
      );
      const r = f(10);
      A(E(r, 11));
      A(E(seen, 11));
    });
  });

  D("U  Unfold / Until", () => {
    E("Unfold generates a sequence", () => {
      const ones = U(1, (n: number) => (n > 5 ? null : ([n, n + 1] as const)));
      const arr = [...ones];
      A(E(arr.length, 5));
      A(E(arr[0], 1));
      A(E(arr[4], 5));
    });
    E("Until loops with iteration cap", () => {
      let i = 0;
      U(
        () => i >= 3,
        () => {
          i++;
        },
      );
      A(E(i, 3));
    });
  });

  D("V  Values (let-in bindings)", () => {
    E("V threads bindings into body", () => {
      const r = V({ x: 2, y: 3 }, ({ x, y }) => x * y);
      A(E(r, 6));
    });
    E("V returns whatever body returns", () => {
      const nodes = V({ n: 5 }, ({ n }) => [n, n * 2, n * 3]);
      A(E(nodes.length, 3));
      A(E(nodes[2], 15));
    });
  });

  D("W  When / While", () => {
    E("While loops with iteration cap", () => {
      let i = 0,
        total = 0;
      W(
        () => i < 5,
        () => {
          total += i;
          i++;
        },
      );
      A(E(i, 5));
      A(E(total, 10)); // 0+1+2+3+4
    });
  });

  D("Y  Bounce / Trampoline", () => {
    E("Y handles deep recursion without stack overflow", () => {
      // Self-reference in Y requires breaking the type cycle. Simplest:
      // declare the inner fn separately, tag its return type explicitly.
      const step = (
        n: number,
        acc: number,
      ): number | Bounce<[number, number]> =>
        n <= 0 ? acc : Y.bounce(sum, n - 1, acc + n);
      const sum = Y<[number, number], number>(step);
      A(E(sum(10_000, 0), 50_005_000));
    });
  });

  D("Z  Zip", () => {
    E("Z pairs two arrays to shortest length", () => {
      const r = Z([1, 2, 3], ["a", "b"]);
      A(E(r.length, 2));
      A(E(r[0]![0], 1));
      A(E(r[0]![1], "a"));
    });
    E("Z handles three arrays", () => {
      const r = Z([1, 2], ["a", "b"], [true, false]);
      A(E(r.length, 2));
      A(E(r[0]!.length, 3));
    });
  });

  D("Logic programming: F / S / X / withKB", () => {
    E("X queries a single relation", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        const kids = X("parent", "alice", _("c"));
        A(E(kids.length, 1));
        A(E(kids[0]!.c, "bob"));
      });
    });
    E("X(rel) 1-arg form counts facts of any arity", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        F("color", "red");
        // 1-arg X returns one empty substitution per match — Q-friendly
        A(E(Q(X("parent")), 2));
        A(E(Q(X("color")), 1));
        A(E(Q(X("nonexistent")), 0));
      });
    });
    E("S solves conjoined goals (grandparent rule)", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        F("parent", "carol", "dan");
        const gps = S([
          goal("parent", "alice", _("mid")),
          goal("parent", _("mid"), _("grand")),
        ]);
        A(E(gps.length, 1));
        A(E(gps[0]!.mid, "bob"));
        A(E(gps[0]!.grand, "carol"));
      });
    });
    E("withKB isolates across scopes", () => {
      withKB([], () => {
        F("inner", "secret");
      });
      const leak = X("inner", _("v"));
      A(E(leak.length, 0));
    });
  });

  D("Never (N as anti-fact)", () => {
    E("N(Fact) constructs a NeverGoal", () => {
      const g = N(goal("color", "red"));
      A(E((g as any).__never, true));
      A(E((g as any).goal.relation, "color"));
    });
    E("N as never-goal: excludes solutions that unify", () => {
      withKB([], () => {
        F("parent", "alice", "bob");
        F("parent", "bob", "carol");
        F("parent", "carol", "dan");
        // parents who are NOT themselves grandparents (i.e., their child is childless)
        const results = S([
          goal("parent", _("x"), _("y")),
          N(goal("parent", _("y"), _("z"))),
        ]);
        A(E(results.length, 1));
        A(E(results[0]!.x, "carol"));
        A(E(results[0]!.y, "dan"));
      });
    });
    E("never-goal with ground-but-absent fact succeeds", () => {
      withKB([], () => {
        F("color", "red");
        F("color", "blue");
        // all colors that aren't green (green isn't in KB, so never succeeds for all)
        const results = S([goal("color", _("c")), N(goal("color", "green"))]);
        A(E(results.length, 2));
      });
    });
    E("never-goal with ground-and-present fact rejects all", () => {
      withKB([], () => {
        F("color", "red");
        F("color", "blue");
        const results = S([goal("color", _("c")), N(goal("color", "red"))]);
        A(E(results.length, 0));
      });
    });
  });

  D("Runner kbScope: inherit", () => {
    E("inherit preserves outer KB facts inside run()", async () => {
      await withKB([], async () => {
        F("outer", "hello");
        // Build a tiny suite that queries the outer KB
        const suite = G([
          "outer-visible",
          [
            "state",
            {},
            W(
              "fact-reachable",
              T("outer fact is visible", () => {
                A(E(X("outer", _("v"))[0]!.v, "hello"));
              }),
            ),
          ],
        ]);
        const report = await run(suite, { kbScope: "inherit", silent: true });
        A(E(report.failed, 0));
        A(E(report.passed, 1));
      });
    });
    E("default (then) still isolates per assertion", async () => {
      await withKB([], async () => {
        F("outer", "visible");
        const suite = G([
          "isolated",
          [
            "state",
            {},
            W(
              "fact-invisible",
              T("outer fact is NOT visible under then-scope", () => {
                // Default kbScope is "then" — fresh KB per assertion
                A(E(X("outer", _("v")).length, 0));
              }),
            ),
          ],
        ]);
        const report = await run(suite, { silent: true });
        A(E(report.passed, 1));
      });
    });
  });

  D("Runner reporters", () => {
    E("TAP reporter emits version and plan", async () => {
      const suite = G([
        "suite",
        [
          "state",
          {},
          W(
            "w",
            T("t passes", () => A(true)),
          ),
        ],
      ]);
      let out = "";
      const write = (s: string) => {
        out += s;
      };
      await run(suite, { reporter: "tap", write });
      A(
        out.startsWith("TAP version 14"),
        `expected TAP header, got ${out.slice(0, 40)}`,
      );
      A(out.includes("ok 1"), "expected 'ok 1' line");
      A(out.includes("1..1"), "expected plan line");
    });
    E("TAP reporter emits 'not ok' on failure", async () => {
      const suite = G([
        "suite",
        [
          "state",
          {},
          W(
            "w",
            T("t fails", () => A(false, "nope")),
          ),
        ],
      ]);
      let out = "";
      await run(suite, {
        reporter: "tap",
        write: (s) => {
          out += s;
        },
      });
      A(out.includes("not ok 1"));
      A(out.includes("nope"));
    });
    E("JUnit reporter emits valid XML skeleton", async () => {
      const suite = G([
        "suite",
        [
          "state",
          {},
          W(
            "w",
            T("t", () => A(true)),
          ),
        ],
      ]);
      let out = "";
      await run(suite, {
        reporter: "junit",
        write: (s) => {
          out += s;
        },
      });
      A(out.startsWith("<?xml"));
      A(out.includes("<testsuite"));
      A(out.includes("<testcase"));
      A(out.includes("</testsuite>"));
    });
    E("null reporter emits nothing", async () => {
      const suite = G([
        "suite",
        [
          "state",
          {},
          W(
            "w",
            T("t", () => A(true)),
          ),
        ],
      ]);
      let out = "";
      const report = await run(suite, {
        reporter: "null",
        write: (s) => {
          out += s;
        },
      });
      A(E(out, ""));
      A(E(report.passed, 1));
    });
    E("custom Reporter object works", async () => {
      const events: string[] = [];
      const custom = {
        name: "custom",
        onRunStart: () => events.push("start"),
        onResult: (r: any) => events.push(`result:${r.status}`),
        onRunEnd: () => events.push("end"),
      };
      const suite = G([
        "suite",
        [
          "state",
          {},
          W(
            "w",
            T("t", () => A(true)),
          ),
        ],
      ]);
      await run(suite, { reporter: custom, write: () => {} });
      A(E(events[0], "start"));
      A(events.includes("result:passed"));
      A(E(events[events.length - 1], "end"));
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
      const r = F<number, number>([1, 2, 3, 4], 0, (a, x) =>
        x === 3 ? Promise.resolve(a + x) : a + x,
      );
      A(isPromise(r));
      A(E(await r, 10));
    });
  });
});

// -----------------------------------------------------------------------------
// BDD suite: one Given, exercising runner + fixture injection
// -----------------------------------------------------------------------------

const bdd = G([
  "Arithmetic",
  [
    "Positive operands",
    { a: 2, b: 3 },
    W(
      "added",
      T<{ a: number; b: number }>("sum equals 5", ({ a, b }) => A(E(a + b, 5))),
    ),
    W(
      "multiplied",
      T<{ a: number; b: number }>("product equals 6", ({ a, b }) =>
        A(E(a * b, 6)),
      ),
    ),
  ],
  [
    "Negative first operand",
    { a: -5, b: 3 },
    W(
      "added",
      T<{ a: number; b: number }>("sum equals -2", ({ a, b }) =>
        A(E(a + b, -2)),
      ),
    ),
  ],
]);

// V-style BDD example (fixture in state tuple is metadata; V provides bindings)
const bddV = G([
  "Closure-bound fixtures",
  [
    "State using V",
    {},
    ...V({ x: 10, y: 20 }, ({ x, y }) => [
      W(
        "sum computed",
        T("x + y = 30", () => A(E(x + y, 30))),
      ),
      W(
        "product computed",
        T("x * y = 200", () => A(E(x * y, 200))),
      ),
    ]),
  ],
]);

// KB scope demo: assert facts across whens within a state
const bddKB = G([
  "Accumulating facts across Whens",
  [
    "Single state, multi-when",
    {},
    W(
      "assert first fact",
      T("one fact visible", () => {
        F("color", "red");
        A(E(X("color", _("c")).length, 1));
      }),
    ),
    W(
      "assert second fact",
      T("two facts visible under state-scope", () => {
        F("color", "blue");
        A(E(X("color", _("c")).length, 2));
      }),
    ),
  ],
]);

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

const report1 = await run(xunit);
console.log("");
const report2 = await run(bdd);
console.log("");
const report3 = await run(bddV);
console.log("");
const report4 = await run(bddKB, { kbScope: "state" });

const totals = [report1, report2, report3, report4].reduce(
  (a, r) => ({
    passed: a.passed + r.passed,
    failed: a.failed + r.failed,
    skipped: a.skipped + r.skipped,
  }),
  { passed: 0, failed: 0, skipped: 0 },
);

console.log(`\n=============================================`);
console.log(
  `TOTAL: ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped`,
);
console.log(`=============================================`);

if (totals.failed > 0) process.exit(1);

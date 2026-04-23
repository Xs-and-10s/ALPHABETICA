// =============================================================================
// alphabetica.fuzz.mjs — property-based tests using fast-check
// =============================================================================
// Runs against the ESM build (alphabetica.mjs). Covers the highest-signal
// targets: B pattern matcher, S unification, F fold, Y trampoline, Z zip.
//
// Every version bump in this project has been driven by a pattern-matcher
// or unifier bug (array length silent match, SV distribution, bare `_` in
// goals). These properties lock in the invariants that should hold
// regardless of input shape.
//
// To run: npm run test:fuzz
// =============================================================================

import fc from "fast-check";
import {
  _, B, F, S, X, Y, Z,
  goal, withKB,
} from "./alphabetica.mjs";

const NUM_RUNS = 200;
let totalProperties = 0;
let totalFailures = 0;

function prop(name, property) {
  totalProperties++;
  try {
    fc.assert(property, { numRuns: NUM_RUNS });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    totalFailures++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message.split("\n").slice(0, 6).join("\n    ")}`);
  }
}

function group(label, body) {
  console.log(`\n${label}`);
  body();
}

// -----------------------------------------------------------------------------
// B — pattern matcher
// -----------------------------------------------------------------------------

group("B — pattern matcher", () => {
  prop("literal value matches identical literal",
    fc.property(fc.oneof(fc.integer(), fc.string(), fc.boolean()), (v) => {
      const r = B(v, [v, () => "hit"], [_, () => "miss"]);
      return r === "hit";
    }));

  prop("distinct literals never match",
    fc.property(fc.integer({min: 0, max: 100}), fc.integer({min: 101, max: 200}), (a, b) => {
      const r = B(a, [b, () => "hit"], [_, () => "miss"]);
      return r === "miss";
    }));

  prop("LVar always matches and captures entire value",
    fc.property(fc.oneof(fc.integer(), fc.string(), fc.constantFrom(null, true, false)), (v) => {
      const r = B(v, [_("x"), ({x}) => x]);
      return Object.is(r, v);
    }));

  prop("bare wildcard always matches",
    fc.property(fc.anything(), (v) => {
      const r = B(v, [_, () => "matched"], [_, () => "fallback"]);
      return r === "matched";
    }));

  prop("array pattern matches same-length array",
    fc.property(fc.array(fc.integer(), {minLength: 2, maxLength: 2}), ([a, b]) => {
      const r = B([a, b], [[_("x"), _("y")], ({x, y}) => [x, y]]);
      return r[0] === a && r[1] === b;
    }));

  prop("array length mismatch does not match (the 0.4.1 silent bug)",
    fc.property(fc.array(fc.integer(), {minLength: 3, maxLength: 3}), (arr) => {
      // Pattern has 2 LVars; scrutinee has 3 elements. Must NOT match.
      const r = B(arr,
        [[_("x"), _("y")], () => "matched-short"],
        [_, () => "fallthrough"],
      );
      return r === "fallthrough";
    }));

  prop("rest capture on trailing position collects the tail",
    fc.property(fc.array(fc.integer(), {minLength: 2, maxLength: 6}), (arr) => {
      const r = B(arr, [[_("h"), _.rest("rest")], ({h, rest}) => ({h, rest})]);
      return r.h === arr[0]
          && Array.isArray(r.rest)
          && r.rest.length === arr.length - 1
          && r.rest.every((v, i) => Object.is(v, arr[i + 1]));
    }));

  prop("object pattern matches when all pattern keys present and equal",
    fc.property(fc.string(), fc.integer(), (kind, count) => {
      const obj = {kind, count, extra: "ignored"};
      const r = B(obj, [{kind, count}, () => "hit"], [_, () => "miss"]);
      return r === "hit";
    }));

  prop("object pattern with mismatching literal does not match",
    fc.property(
      fc.string({minLength: 1}),
      fc.string({minLength: 1}).filter(s => s !== "x"),
      (k, v) => {
        const obj = {[k]: v};
        const r = B(obj, [{[k]: "x"}, () => "hit"], [_, () => "miss"]);
        return r === "miss";
      }));

  prop("predicate pattern runs the predicate, matches on true",
    fc.property(fc.integer({min: -100, max: 100}), (n) => {
      const r = B(n,
        [(x) => x >= 0, () => "nonneg"],
        [(x) => x < 0,  () => "neg"],
      );
      return n >= 0 ? r === "nonneg" : r === "neg";
    }));

  prop("first matching arm wins",
    fc.property(fc.integer(), (n) => {
      const r = B(n,
        [(x) => typeof x === "number", () => "first"],
        [(x) => typeof x === "number", () => "second"],
      );
      return r === "first";
    }));

  prop("nested object patterns narrow both levels",
    fc.property(fc.integer(), fc.string(), (n, s) => {
      const obj = {outer: {inner: {kind: "deep", n, s}}};
      const r = B(obj, [
        {outer: {inner: {kind: "deep", n: _("nn"), s: _("ss")}}},
        ({nn, ss}) => [nn, ss],
      ]);
      return r[0] === n && r[1] === s;
    }));
});

// -----------------------------------------------------------------------------
// S / unification — logic solver
// -----------------------------------------------------------------------------

group("S — unification", () => {
  prop("query with all LVars returns one substitution per fact",
    fc.property(
      fc.array(fc.integer(), {minLength: 0, maxLength: 10}),
      (vals) => {
        return withKB([], () => {
          for (const v of vals) F("n", v);
          const r = S([goal("n", _("x"))]);
          return r.length === vals.length;
        });
      }));

  prop("query returns all matching facts",
    fc.property(
      fc.array(fc.tuple(fc.string({minLength: 1}), fc.integer()), {minLength: 1, maxLength: 8}),
      (facts) => {
        return withKB([], () => {
          for (const [name, n] of facts) F("entry", name, n);
          const r = S([goal("entry", _("name"), _("n"))]);
          return r.length === facts.length;
        });
      }));

  prop("bare _ in goal matches any ground term (the 0.4.3 bug)",
    fc.property(
      fc.array(fc.string({minLength: 1}), {minLength: 1, maxLength: 10}),
      (names) => {
        return withKB([], () => {
          for (const name of names) F("color", name);
          const r = S([goal("color", _)]);
          return r.length === names.length;
        });
      }));

  prop("same query run twice returns same number of results (deterministic)",
    fc.property(
      fc.array(fc.tuple(fc.string({minLength: 1}), fc.string({minLength: 1})), {minLength: 1, maxLength: 6}),
      (pairs) => {
        return withKB([], () => {
          for (const [a, b] of pairs) F("pair", a, b);
          const r1 = S([goal("pair", _("x"), _("y"))]);
          const r2 = S([goal("pair", _("x"), _("y"))]);
          return r1.length === r2.length;
        });
      }));

  prop("X(rel, ...lvars) count equals S([goal(rel, ...)]) count",
    fc.property(fc.array(fc.integer(), {minLength: 0, maxLength: 8}), (vals) => {
      return withKB([], () => {
        for (const v of vals) F("n", v);
        const fromX = X("n", _("v"));
        const fromS = S([goal("n", _("v"))]);
        return fromX.length === fromS.length && fromX.length === vals.length;
      });
    }));

  prop("nonexistent relation returns empty",
    fc.property(fc.array(fc.integer(), {minLength: 0, maxLength: 5}), (vals) => {
      return withKB([], () => {
        for (const v of vals) F("exists", v);
        const r = S([goal("does_not_exist", _)]);
        return r.length === 0;
      });
    }));
});

// -----------------------------------------------------------------------------
// F — fold
// -----------------------------------------------------------------------------

group("F — fold", () => {
  prop("fold of addition from 0 equals sum",
    fc.property(fc.array(fc.integer({min: -1000, max: 1000})), (arr) => {
      const sum = arr.reduce((a, b) => a + b, 0);
      return F(arr, 0, (a, x) => a + x) === sum;
    }));

  prop("fold is left-to-right (order matters for non-associative ops)",
    fc.property(fc.array(fc.integer({min: 1, max: 100}), {minLength: 2, maxLength: 5}), (arr) => {
      const expected = arr.reduce((a, b) => a - b);
      const got = F(arr.slice(1), arr[0], (a, x) => a - x);
      return got === expected;
    }));

  prop("fold over empty array returns seed",
    fc.property(fc.anything(), (seed) => {
      const r = F([], seed, (_a, _x) => "changed");
      return Object.is(r, seed);
    }));

  prop("fold invokes fn exactly arr.length times",
    fc.property(fc.array(fc.constant(1), {minLength: 0, maxLength: 20}), (arr) => {
      let calls = 0;
      F(arr, 0, (a, x) => { calls++; return a + x; });
      return calls === arr.length;
    }));
});

// -----------------------------------------------------------------------------
// Y — trampoline
// -----------------------------------------------------------------------------

group("Y — trampoline", () => {
  prop("trampolined factorial equals iterative factorial",
    fc.property(fc.integer({min: 0, max: 12}), (n) => {
      const step = (n, acc = 1) => n <= 1 ? acc : Y.bounce(fact, n - 1, acc * n);
      const fact = Y(step);
      const expected = Array.from({length: n}, (_, i) => i + 1).reduce((a, b) => a * b, 1);
      return fact(n) === expected;
    }));

  prop("trampolined sum avoids stack overflow at depth 50,000",
    fc.property(fc.constant(50000), (n) => {
      const step = (i, acc = 0) => i === 0 ? acc : Y.bounce(sum, i - 1, acc + i);
      const sum = Y(step);
      return sum(n) === n * (n + 1) / 2;
    }));

  prop("trampolined identity is identity",
    fc.property(fc.integer(), (n) => {
      const id = Y((v) => v);
      return id(n) === n;
    }));

  prop("non-bouncing return short-circuits (no recursion)",
    fc.property(fc.integer(), (n) => {
      // If fn returns non-bounce immediately, Y returns that value as-is.
      const f = Y((x) => x * 2);
      return f(n) === n * 2;
    }));
});

// -----------------------------------------------------------------------------
// Z — zip
// -----------------------------------------------------------------------------

group("Z — zip", () => {
  prop("zip output length is min of input lengths",
    fc.property(fc.array(fc.integer()), fc.array(fc.string()), (a, b) => {
      return Z(a, b).length === Math.min(a.length, b.length);
    }));

  prop("zip pairs align positionally",
    fc.property(fc.array(fc.integer(), {minLength: 1, maxLength: 10}), (arr) => {
      const doubled = arr.map(x => x * 2);
      const zipped = Z(arr, doubled);
      return zipped.every(([a, b], i) => a === arr[i] && b === doubled[i]);
    }));

  prop("zip of empty with anything is empty",
    fc.property(fc.array(fc.anything()), (b) => {
      return Z([], b).length === 0;
    }));

  prop("zip of three arrays is bounded by shortest",
    fc.property(fc.array(fc.integer()), fc.array(fc.integer()), fc.array(fc.integer()), (a, b, c) => {
      return Z(a, b, c).length === Math.min(a.length, b.length, c.length);
    }));
});

// -----------------------------------------------------------------------------

console.log(`\n${"=".repeat(60)}`);
console.log(`fuzz suite: ${totalProperties} properties, ${totalFailures} failed, ${NUM_RUNS} runs each`);
console.log(`${"=".repeat(60)}`);

if (totalFailures > 0) process.exit(1);

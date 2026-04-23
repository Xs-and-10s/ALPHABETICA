// =============================================================================
// alphabetica.test-d.ts — type-level tests
// =============================================================================
// These tests assert TypeScript's inference behavior on B's type machinery
// (ExtractCaptures, Narrow, and Arm distribution). They execute entirely
// at `tsc --noEmit` time — no runtime. They lock in the type-level
// regressions we've hit across 0.4.0–0.4.3 so any future refactor of
// Narrow<P,S> or NarrowOne<P,S> can't silently break them.
//
// To run: npm run test:types
// =============================================================================

import { expectTypeOf } from "expect-type";
import type { ExtractCaptures, Narrow, LVar } from "./alphabetica.ts";
import { _ } from "./alphabetica.ts";

// -----------------------------------------------------------------------------
// ExtractCaptures — structural capture extraction with realistic scrutinees
// -----------------------------------------------------------------------------

// 1. Single LVar at top level captures the entire scrutinee.
{
  type S = { name: string };
  type T = ExtractCaptures<LVar<"x">, S>;
  expectTypeOf<T>().toEqualTypeOf<{ x: S }>();
}

// 2. Object pattern with 1 LVar: capture gets the field's type.
{
  type S = { kind: "user"; name: string };
  type P = { readonly kind: "user"; readonly name: LVar<"n"> };
  type T = ExtractCaptures<P, S>;
  expectTypeOf<T>().toEqualTypeOf<{ n: string }>();
}

// 3. Object with 2 LVars: each keyed by its own name.
{
  type S = { kind: string; count: number };
  type P = { readonly kind: LVar<"k">; readonly count: LVar<"c"> };
  type T = ExtractCaptures<P, S>;
  expectTypeOf<T>().toEqualTypeOf<{ k: string; c: number }>();
}

// 4. Nested object: captures flow through the nesting.
{
  type S = { outer: { inner: boolean } };
  type P = { readonly outer: { readonly inner: LVar<"deep"> } };
  type T = ExtractCaptures<P, S>;
  expectTypeOf<T>().toEqualTypeOf<{ deep: boolean }>();
}

// 5. Literal-only pattern has no captures.
{
  type S = { kind: "ok"; flag: boolean };
  type P = { readonly kind: "ok"; readonly flag: true };
  type T = ExtractCaptures<P, S>;
  expectTypeOf<T>().toEqualTypeOf<{}>();
}

// 6. Array positional LVars: each capture matches its position's type.
{
  type S = readonly [string, number, boolean];
  type P = readonly [LVar<"a">, LVar<"b">, LVar<"c">];
  type T = ExtractCaptures<P, S>;
  expectTypeOf<T>().toMatchTypeOf<{ a: string; b: number; c: boolean }>();
}

// 7. Array with mixed LVar + literal: only LVar positions create captures.
{
  type S = readonly [string, number];
  type P = readonly ["fixed", LVar<"n">];
  type T = ExtractCaptures<P, S>;
  expectTypeOf<T>().toMatchTypeOf<{ n: number }>();
}

// -----------------------------------------------------------------------------
// Narrow<P, S> — pattern narrows scrutinee type
// -----------------------------------------------------------------------------

// 8. Literal pattern narrows a union to the compatible variant.
{
  type U = { kind: "ok"; data: number } | { kind: "err"; reason: string };
  type N = Narrow<{ readonly kind: "ok" }, U>;
  expectTypeOf<N>().toEqualTypeOf<{ kind: "ok"; data: number }>();
}

// 9. Discriminant narrows tagged union on the discriminant key.
{
  type U =
    | { tag: "A"; aVal: number }
    | { tag: "B"; bVal: string }
    | { tag: "C"; cVal: boolean };
  type N = Narrow<{ readonly tag: "B" }, U>;
  expectTypeOf<N>().toEqualTypeOf<{ tag: "B"; bVal: string }>();
}

// 10. Discriminant filters variants that don't have the key at all.
{
  type U =
    | { kind: "ok"; data: number }
    | { kind: "err"; reason: string }
    | { type: "legacy"; v: number };
  type N = Narrow<{ readonly kind: "ok" }, U>;
  expectTypeOf<N>().toEqualTypeOf<{ kind: "ok"; data: number }>();
}

// 11. Type-guard function narrows via Extract.
{
  type U = { kind: "ok"; data: number } | { kind: "err"; reason: string };
  const guard = (v: unknown): v is { kind: "ok"; data: number } =>
    typeof v === "object" && v !== null && "data" in v;
  type N = Narrow<typeof guard, U>;
  expectTypeOf<N>().toEqualTypeOf<{ kind: "ok"; data: number }>();
}

// 12. Plain predicate (not a type guard) keeps S unchanged.
{
  type U = { kind: "ok"; data: number } | { kind: "err"; reason: string };
  type N = Narrow<(v: any) => boolean, U>;
  expectTypeOf<N>().toEqualTypeOf<U>();
}

// 13. Wildcard doesn't narrow.
{
  type U = { kind: "ok"; data: number } | { kind: "err"; reason: string };
  type N = Narrow<typeof _, U>;
  expectTypeOf<N>().toEqualTypeOf<U>();
}

// 14. Bare LVar doesn't narrow.
{
  type U = { kind: "ok"; data: number } | { kind: "err"; reason: string };
  type N = Narrow<LVar<"x">, U>;
  expectTypeOf<N>().toEqualTypeOf<U>();
}

// 15. Nested two-level narrowing: outer tag AND inner kind both narrow.
{
  type Outer =
    | {
        tag: "A";
        inner:
          | { kind: "user"; name: string }
          | { kind: "admin"; perms: string[] };
      }
    | { tag: "B"; value: number };
  type N = Narrow<
    { readonly tag: "A"; readonly inner: { readonly kind: "user" } },
    Outer
  >;
  expectTypeOf<N>().toMatchTypeOf<{
    tag: "A";
    inner: { kind: "user"; name: string };
  }>();
}

// 16. Array literal at position 0 narrows heterogeneous tuple union.
{
  type Shape =
    | readonly ["circle", number]
    | readonly ["square", number, number]
    | readonly ["text", string];
  type N = Narrow<readonly ["circle", LVar<"r">], Shape>;
  expectTypeOf<N>().toEqualTypeOf<readonly ["circle", number]>();
}

// 17. Array trailing literal narrows (match by position).
{
  type Cmd = readonly ["run", string] | readonly ["stop"] | readonly ["status"];
  type N = Narrow<readonly ["run", LVar<"arg">], Cmd>;
  expectTypeOf<N>().toEqualTypeOf<readonly ["run", string]>();
}

// 18. Length-discriminated tuple union narrows per arm.
{
  type LU = readonly [string] | readonly [string, number];
  type NShort = Narrow<readonly [LVar<"s">], LU>;
  type NLong = Narrow<readonly [LVar<"s">, LVar<"n">], LU>;
  expectTypeOf<NShort>().toEqualTypeOf<readonly [string]>();
  expectTypeOf<NLong>().toEqualTypeOf<readonly [string, number]>();
}

// -----------------------------------------------------------------------------
// Regression tests — bugs caught across 0.4.0–0.4.3
// -----------------------------------------------------------------------------

// 19. Capture inference against union scrutinee produces single type, not
// a distributed union. Pre-fix, `ExtractCaptures<{data:LVar<"x">}, Ok|Err>`
// sometimes widened to `{x:number} | {}`. With the `[SV] extends [object]`
// guard in place, it correctly narrows scrutinee first, then captures.
{
  type U = { kind: "ok"; data: number } | { kind: "err"; reason: string };
  type P = { readonly kind: "ok"; readonly data: LVar<"x"> };
  type T = ExtractCaptures<P, U>;
  expectTypeOf<T>().toEqualTypeOf<{ x: number }>();
}

// 20. IsCompatibleValue does not distribute over SV union.
// Pre-fix, `{kind:"user"}` against a scrutinee whose `.kind` was a union
// distributed into `boolean` rather than a single verdict. The
// `[SV] extends [object]` guard prevents this.
{
  type U = { kind: "user"; name: string } | { kind: "admin"; perms: string[] };
  type N = Narrow<{ readonly kind: "user" }, U>;
  expectTypeOf<N>().toEqualTypeOf<{ kind: "user"; name: string }>();
}

// 21. Array exact-length excludes shorter/longer tuples.
// Pre-0.4.1, `[LVar<"a">, LVar<"b">]` would silently match a 3-tuple.
{
  type U =
    | readonly [number]
    | readonly [number, number]
    | readonly [number, number, number];
  type N = Narrow<readonly [LVar<"a">, LVar<"b">], U>;
  expectTypeOf<N>().toEqualTypeOf<readonly [number, number]>();
}

// -----------------------------------------------------------------------------
// If this file typechecks with no errors, all 21 type-level assertions pass.
// -----------------------------------------------------------------------------
console.log("type tests: all 21 assertions compiled cleanly");

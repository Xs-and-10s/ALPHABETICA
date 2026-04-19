// =============================================================================
// B.exhaustive type-level tests
// =============================================================================
// Exhaustiveness is enforced via the RETURN TYPE of B.exhaustive: when arms
// don't cover the scrutinee, the return becomes a poisoned error object.
// To surface the error, callers must actually use the return value — assign
// it to a typed binding, destructure it, or pass it to another function.
// =============================================================================

import { B, _, A, E } from "./alphabetica.ts";

type User = { kind: "user"; name: string };
type Admin = { kind: "admin"; name: string; perms: readonly string[] };
type UorA = User | Admin;

// ---- Case 1: exhaustive — return is usable as the normal result type ----
const classifyOK = (v: UorA): string =>
  B.exhaustive(
    v,
    [{ kind: "user" }, (_c, u) => `user ${u.name}`],
    [{ kind: "admin" }, (_c, a) => `admin ${a.name}`],
  );
A(E(classifyOK({ kind: "user", name: "alice" }), "user alice"));
A(E(classifyOK({ kind: "admin", name: "bob", perms: [] }), "admin bob"));

// ---- Case 2: non-exhaustive — return type is poisoned; assignment fails ----
// @ts-expect-error — Admin not covered; return is not assignable to string
const classifyBad = (v: UorA): string =>
  B.exhaustive(v, [{ kind: "user" }, (_c, u) => `user ${u.name}`]);
void classifyBad;

// ---- Case 3: wildcard exhausts anything ----
const classifyWildcard = (v: UorA): string =>
  B.exhaustive(
    v,
    [{ kind: "user" }, (_c, u) => u.name],
    [_, (_c, other) => `other ${other.kind}`],
  );
A(
  E(classifyWildcard({ kind: "admin", name: "bob", perms: [] }), "other admin"),
);

// ---- Case 4: LVar catch-all exhausts ----
const catchall = (v: UorA): string =>
  B.exhaustive(v, [_("whole"), ({ whole }) => whole.kind]);
A(E(catchall({ kind: "user", name: "x" }), "user"));

// ---- Case 5: exhaustive string literal union ----
type Color = "red" | "green" | "blue";
const c: Color = "red";
const colorNumOK: number = B.exhaustive(
  c,
  ["red", () => 1],
  ["green", () => 2],
  ["blue", () => 3],
);
A(E(colorNumOK, 1));

// ---- Case 6: non-exhaustive string union — return not assignable ----
// @ts-expect-error — "blue" not covered
const colorNumBad: number = B.exhaustive(
  "red" as Color,
  ["red", () => 1],
  ["green", () => 2],
);
void colorNumBad;

// ---- Case 7: plain B throws at runtime when no arm matches ----
const looseOK = (v: UorA) =>
  B(v, [{ kind: "user" }, (_c, u) => `user ${u.name}`]);
try {
  looseOK({ kind: "admin", name: "bob", perms: [] });
  throw new Error("expected B to throw on missing arm");
} catch (e) {
  A((e as Error).message.startsWith("B:"));
}

console.log("exhaustive.test: all 7 cases passed");

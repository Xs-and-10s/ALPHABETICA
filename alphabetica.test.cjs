// =============================================================================
// alphabetica.test.cjs — CJS smoke test
// =============================================================================
// Verifies that the CJS build at dist/cjs/alphabetica.js can be require()'d
// and exposes the full alphabet + core runtime helpers. This is a minimal
// sanity test, not a full port of the TS/MJS suites — if those pass, the
// CJS code is the same logic under a different module system, so we only
// need to confirm the loader + exports actually work.
// =============================================================================

const api = require("./dist/cjs/alphabetica.js");

const required = [
  "_", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "run", "goal", "withKB",
  "MODULE_NAME", "MODULE_DOC", "DOC", "WILDCARD", "BOUNCE",
  "prettyReporter", "tapReporter", "junitReporter", "nullReporter",
];

const missing = required.filter((k) => !(k in api));
if (missing.length > 0) {
  console.error(`CJS: missing exports: ${missing.join(", ")}`);
  process.exit(1);
}

// Exercise a few things to confirm behavior works, not just loading.
const { A, B, E, F, _, withKB, goal, S, X } = api;

// 1. Assertion
A(E(1 + 1, 2));

// 2. Pattern match with capture
const r1 = B({ kind: "user", name: "alice" },
  [{ kind: "user" }, (_c, v) => v.name],
);
A(E(r1, "alice"));

// 3. Fold
A(E(F([1, 2, 3, 4], 0, (a, x) => a + x), 10));

// 4. Logic programming (synchronous)
withKB([], () => {
  F("color", "red");
  F("color", "blue");
  A(E(X("color", _("c")).length, 2));
  A(E(S([goal("color", _)]).length, 2));
});

console.log(`CJS: ok (${required.length} exports verified, 4 runtime checks passed)`);

// =============================================================================
// pkg-audit — npm package health auditor, built on ALPHABETICA
// =============================================================================
// Usage:
//   node audit.mjs <path> [--fail-fast] [--only=ruleId] [--min-severity=warn]
// =============================================================================

import {
  _, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
  run, goal, withKB, MODULE_NAME, MODULE_DOC,
} from "@xs-and-10s/alphabetica";

// -----------------------------------------------------------------------------
// CLI flags: F (fold) + B (pattern match on flag shapes)
// -----------------------------------------------------------------------------

const flags = F(process.argv.slice(2),
  { target: null, failFast: false, only: null, minSeverity: "info", reporter: "pretty" },
  (acc, arg) => B(arg,
    ["--fail-fast", () => ({ ...acc, failFast: true })],
    [(s) => typeof s === "string" && s.startsWith("--only="),
      () => ({ ...acc, only: arg.slice("--only=".length) })],
    [(s) => typeof s === "string" && s.startsWith("--min-severity="),
      () => ({ ...acc, minSeverity: arg.slice("--min-severity=".length) })],
    [(s) => typeof s === "string" && s.startsWith("--reporter="),
      () => ({ ...acc, reporter: arg.slice("--reporter=".length) })],
    [(s) => typeof s === "string" && !s.startsWith("--"),
      () => ({ ...acc, target: arg })],
    [_, () => acc],
  ));

A(flags.target !== null, "usage: node audit.mjs <path> [flags]");

// -----------------------------------------------------------------------------
// Report class via C("name", spec)
// -----------------------------------------------------------------------------

const Report = C("Report", {
  constructor() {
    this.entries = [];
    this.startedAt = performance.now();
  },
  methods: {
    record(rule, status, message) {
      this.entries.push({ rule, status, message });
    },
    countBy(status) {
      return Q(this.entries.filter((e) => e.status === status));
    },
    elapsedMs() {
      return performance.now() - this.startedAt;
    },
  },
});

// -----------------------------------------------------------------------------
// Fact gathering — asserts into the ambient KB
// -----------------------------------------------------------------------------

async function gatherFacts(dir) {
  // A-Attempt wrapping — rethrows with context on failure
  const pkgText = await A(
    async () => R(`${dir}/package.json`, "utf8"),
    `cannot read ${dir}/package.json`,
  );
  const pkg = JSON.parse(pkgText);

  F("field", "name", pkg.name ?? "");
  F("field", "version", pkg.version ?? "");
  F("field", "description", pkg.description ?? "");
  F("field", "license", pkg.license ?? "");

  // Dependencies + pin-style classification via B
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
  for (const [name, spec] of Object.entries(allDeps)) {
    F("dep", name, spec);
    const style = B(spec,
      ["*",      () => "wildcard"],
      ["latest", () => "wildcard"],
      [(s) => typeof s === "string" && s.startsWith("^"),     () => "caret"],
      [(s) => typeof s === "string" && s.startsWith("~"),     () => "tilde"],
      [(s) => typeof s === "string" && /^\d/.test(s),          () => "exact"],
      [(s) => typeof s === "string" && s.startsWith("file:"), () => "file"],
      [_, () => "other"],
    );
    F("pin-style", name, style);
  }

  for (const [scriptName] of Object.entries(pkg.scripts ?? {})) F("script", scriptName);
  if (pkg.engines?.node) F("engines-node", pkg.engines.node);
  F("has-files-field", Array.isArray(pkg.files) && pkg.files.length > 0 ? "yes" : "no");

  for (const f of ["README.md", "LICENSE", "CHANGELOG.md"]) {
    let ok = false;
    try { await R(`${dir}/${f}`, "utf8"); ok = true; } catch {}
    F(ok ? "file-present" : "file-missing", f);
  }

  // Source file scan via X shell + P pipeline with T tap for debug
  const raw = await X`find ${dir} -maxdepth 2 -type f -not -path "*/node_modules/*" -not -path "*/.git/*"`;
  const files = P(
    (s) => s.trim(),
    (s) => s.split("\n"),
    (lines) => lines.filter(Boolean),
    T((lines) => { /* tap: would log count in verbose mode */ void lines; }),
  )(raw);
  for (const f of files) {
    const m = f.match(/\.([^./]+)$/);
    if (m) F("source-ext", m[1]);
  }
}

// -----------------------------------------------------------------------------
// Rule loading — R("./path.mjs") loads modules; default is an M() namespace
// -----------------------------------------------------------------------------

async function loadRules() {
  const deps = (await R("./rules/deps.mjs", import.meta.url)).default;
  const meta = (await R("./rules/meta.mjs", import.meta.url)).default;
  console.log(`  loaded: ${deps[MODULE_NAME]} — ${deps[MODULE_DOC]}`);
  console.log(`  loaded: ${meta[MODULE_NAME]} — ${meta[MODULE_DOC]}`);

  // Rules are method names starting with "check". O sorts for stable output.
  const rulesOf = (mod) => O(Object.keys(mod).filter((k) => k.startsWith("check")))
    .map((name) => ({ id: `${mod.id}/${name}`, fn: mod[name].bind(mod) }));

  return [...rulesOf(deps), ...rulesOf(meta)];
}

// -----------------------------------------------------------------------------
// Main — L/J for early-exit on --fail-fast
// -----------------------------------------------------------------------------

await withKB([], async () => {
  const report = new Report();
  console.log(`\nAuditing ${flags.target}  (min-severity=${flags.minSeverity}${flags.failFast ? ", fail-fast" : ""})\n`);

  await gatherFacts(flags.target);

  // Q(X("dep")) — the new 1-arg X form, counted by Q
  console.log(`  ${Q(X("dep"))} deps · ${Q(X("script"))} scripts · ${Q(X("source-ext"))} src files · ${Q(X("file-present"))} docs present\n`);

  const rules = await loadRules();
  console.log(`  running ${Q(rules)} rules\n`);

  // L/J: establish an escape point for --fail-fast
  const exitStatus = L("audit-done", () => {
    for (const rule of rules) {
      if (flags.only !== null && !rule.id.includes(flags.only)) continue;
      const result = rule.fn();
      if (result === null) {
        report.record(rule.id, "pass", "");
        console.log(`  ✓ ${rule.id}`);
      } else {
        report.record(rule.id, "fail", result);
        console.log(`  ✗ ${rule.id}: ${result}`);
        if (flags.failFast) J("audit-done", "halted");
      }
    }
    return "complete";
  });

  const passed = report.countBy("pass");
  const failed = report.countBy("fail");
  const elapsed = report.elapsedMs();

  // B pattern-match on final status. Use E.gt for deciding pass/fail
  const badge = B(exitStatus,
    ["halted",   () => "HALT"],
    ["complete", () => E.gt(failed, 0) ? "FAIL" : "OK"],
    [_,          () => "???"],
  );

  console.log(`\n[${badge}] ${passed} passed, ${failed} failed in ${elapsed.toFixed(1)}ms`);

  if (E.gt(failed, 0)) process.exit(1);
});

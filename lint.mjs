// =============================================================================
// changelog-lint — check that CHANGELOG.md entries match semver bump rules
// =============================================================================
// Usage: node lint.mjs <path-to-CHANGELOG.md>
//
// Rules enforced:
//   - Every entry has a heading matching ## [version] — date
//   - Major bump (x.0.0) requires "### Breaking" or "### Removed" subheading
//   - Minor bump requires "### Added" or "### Changed" subheading
//   - Patch bump requires "### Fixed" subheading (or "### Security")
//   - Pre-release (-alpha, -beta, -rc) is exempt from strict mapping
//   - Versions must be monotonically descending top-to-bottom
// =============================================================================

import {
  _, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
  run, goal, withKB, tapReporter,
} from "@xs-and-10s/alphabetica";

// -----------------------------------------------------------------------------
// Parse CHANGELOG.md into entries
// -----------------------------------------------------------------------------

/**
 * Each entry: { version, date, prerelease, sections: string[] }
 * sections are the "### X" subheadings found before the next "## [..."
 */
function parseChangelog(text) {
  const lines = text.split("\n");
  const entries = [];
  let current = null;

  for (const line of lines) {
    // B pattern-match on line shape
    const action = B(line,
      [(s) => typeof s === "string" && /^## \[[\d.]+(-[A-Za-z0-9.]+)?\]/.test(s),
        () => ({ kind: "entry-header", line })],
      [(s) => typeof s === "string" && /^### /.test(s),
        () => ({ kind: "section", line: line.slice(4).trim() })],
      [_, () => ({ kind: "other" })],
    );

    B(action,
      [{ kind: "entry-header" }, ({}, a) => {
        if (current) entries.push(current);
        const m = a.line.match(/^## \[([\d.]+)(-[A-Za-z0-9.]+)?\](?:\s*[—-]\s*(.+))?/);
        current = {
          version: m[1],
          prerelease: m[2] ? m[2].slice(1) : null,
          date: (m[3] ?? "").trim(),
          sections: [],
        };
      }],
      [{ kind: "section" }, ({}, a) => {
        if (current) current.sections.push(a.line);
      }],
      [_, () => {}],
    );
  }
  if (current) entries.push(current);
  return entries;
}

// -----------------------------------------------------------------------------
// Classify bump kind between two consecutive versions
// -----------------------------------------------------------------------------

function classifyBump(older, newer) {
  const [oM, om, op] = older.split(".").map(Number);
  const [nM, nm, np] = newer.split(".").map(Number);
  return B({ om, op, oM, nm, np, nM },
    // Use the new E.lt/gt helpers
    [(s) => E.gt(s.nM, s.oM), () => "major"],
    [(s) => E.gt(s.nm, s.om), () => "minor"],
    [(s) => E.gt(s.np, s.op), () => "patch"],
    [_, () => "non-monotonic"],
  );
}

// -----------------------------------------------------------------------------
// Assert facts into the KB, then build a BDD suite to check rules
// -----------------------------------------------------------------------------

const target = process.argv[2];
A(typeof target === "string", "usage: node lint.mjs <CHANGELOG.md>");

const useTap = process.argv.includes("--tap");

await withKB([], async () => {
  const text = await R(target, "utf8");
  const entries = parseChangelog(text);
  A(entries.length > 0, "no changelog entries found");

  // Fact gathering
  for (const e of entries) {
    F("entry", e.version);
    if (e.prerelease) F("prerelease", e.version, e.prerelease);
    for (const sec of e.sections) F("section", e.version, sec);
  }

  // Classify bumps between consecutive pairs. U for Unfold gives us
  // sequential pair generation; Z would need two aligned arrays, slightly
  // awkward here. Sticking with a plain for loop.
  for (let i = 0; i < entries.length - 1; i++) {
    const newer = entries[i];
    const older = entries[i + 1];
    const kind = classifyBump(older.version, newer.version);
    F("bump", newer.version, older.version, kind);
  }

  // Build suite — one state per entry, checks run as Whens
  const states = entries.map((e) => [
    `${e.version}${e.prerelease ? `-${e.prerelease}` : ""}`,
    e,
    W("heading well-formed", T("has date line", (entry) => {
      A(entry.date !== "", `version ${entry.version} missing date in heading`);
    })),
    W("bump rule satisfies semver intent", T("bump kind matches sections", (entry) => {
      // Look up what bump this was (if any — the oldest entry has no bump fact)
      const b = X("bump", entry.version, _("older"), _("kind"));
      if (Q(b) === 0) return;  // oldest entry or prerelease

      // Skip strict check if prerelease
      if (entry.prerelease) return;

      const { kind } = b[0];
      const hasSection = (name) => Q(X("section", entry.version, name)) > 0;

      const required = B(kind,
        ["major", () => ["Breaking", "Removed"]],
        ["minor", () => ["Added", "Changed"]],
        ["patch", () => ["Fixed", "Security"]],
        ["non-monotonic", () => null],
        [_, () => null],
      );

      if (required === null) {
        A(false, `version ordering: ${kind} detected at ${entry.version}`);
      }
      const anyMatch = required.some(hasSection);
      A(anyMatch,
        `${kind} bump at ${entry.version} needs one of: ### ${required.join(" / ### ")}`);
    })),
  ]);

  const suite = G(["CHANGELOG integrity", ...states]);

  console.log(`\nLinting ${target} (${entries.length} entries)\n`);
  const report = await run(suite, {
    kbScope: "inherit",
    reporter: useTap ? "tap" : "pretty",
  });

  if (report.failed > 0) process.exit(1);
});

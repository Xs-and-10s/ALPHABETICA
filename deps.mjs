// Rule module — exported as an ALPHABETICA M() namespace.
// The audit tool loads this via R() and iterates over its rules.

import { M, E, A, F, N, Q, S, X, _, goal } from "@xs-and-10s/alphabetica";

// Each rule: { id, severity, describe(), check(facts) => string | null }
// Rule returns null on pass, or a message string on fail.

const Rules = M("DependencyRules", {
  id: "dep-rules",

  checkNoWildcards() {
    const leaks = S([goal("pin-style", _("d"), "wildcard")]);
    return leaks.length === 0 ? null
      : `wildcard pins: ${leaks.map((r) => r.d).join(", ")}`;
  },

  checkNoTildePinning() {
    // Mixed tilde + caret in same project signals inconsistency
    const tildes = S([goal("pin-style", _("d"), "tilde")]);
    const carets = S([goal("pin-style", _("d"), "caret")]);
    if (tildes.length > 0 && carets.length > 0) {
      return `mixed pin styles: ${tildes.length} tilde, ${carets.length} caret`;
    }
    return null;
  },

  checkDepCountReasonable(maxDeps = 50) {
    const n = Q(X("dep"));
    return E.le(n, maxDeps) ? null
      : `${n} dependencies exceeds soft cap of ${maxDeps}`;
  },
}, "Dependency hygiene rules — queries against the fact KB");

export default Rules;

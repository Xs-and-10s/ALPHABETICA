// Metadata rule module — companion to deps.mjs.
// Exports an M() namespace of rule functions that query the shared KB.

import { M, E, A, F, N, Q, S, X, _, goal } from "@xs-and-10s/alphabetica";

const Rules = M("MetadataRules", {
  id: "meta-rules",

  checkNamePresent() {
    const r = X("field", "name", _("n"));
    return r.length === 1 && r[0].n !== "" ? null : "package.json.name is missing or empty";
  },

  checkVersionSemver() {
    const r = X("field", "version", _("v"));
    if (r.length !== 1) return "version field missing";
    return /^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/.test(r[0].v)
      ? null : `version "${r[0].v}" is not semver`;
  },

  checkLicensePresent() {
    const r = X("field", "license", _("l"));
    return r.length === 1 && r[0].l !== "" ? null : "license field missing";
  },

  checkDocsPresent() {
    const required = ["README.md", "LICENSE"];
    const missing = required.filter((f) => Q(X("file-present", f)) === 0);
    return missing.length === 0 ? null : `missing: ${missing.join(", ")}`;
  },

  checkEnginesPinned() {
    return Q(X("engines-node")) === 1 ? null
      : "engines.node not set — CI may drift to unintended versions";
  },

  checkFilesFieldPresent() {
    const r = X("has-files-field", "yes");
    return r.length === 1 ? null
      : "no `files` array — publish surface is unconstrained";
  },
}, "Package metadata rules");

export default Rules;

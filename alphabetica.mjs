// =============================================================================
// ALPHABETICA v0.2.0-alpha — JavaScript (no-build) edition
// =============================================================================
// Mirrors alphabetica.ts 1:1 in behavior. No types, no compile step.
// JSDoc annotations give editors decent inference; for stronger inference,
// use alphabetica.ts via tsx or a bundler.
// =============================================================================

import { AsyncLocalStorage } from "node:async_hooks";

// -----------------------------------------------------------------------------
// Symbols
// -----------------------------------------------------------------------------

export const MODULE_NAME = Symbol("ALPHABETICA.moduleName");
export const MODULE_DOC  = Symbol("ALPHABETICA.moduleDoc");
export const DOC         = Symbol("ALPHABETICA.doc");
export const WILDCARD    = Symbol("ALPHABETICA.wildcard");
export const BOUNCE      = Symbol("ALPHABETICA.bounce");
const Y_ORIGINAL         = Symbol("ALPHABETICA.y.original");

// -----------------------------------------------------------------------------
// Knowledge base scoping (AsyncLocalStorage)
// -----------------------------------------------------------------------------

/** @typedef {{ readonly __fact: true, readonly relation: string, readonly terms: readonly unknown[] }} Fact */
/** @typedef {Fact[]} KnowledgeBase */

const kbStorage = new AsyncLocalStorage();
const rootKB = /** @type {KnowledgeBase} */ ([]);

/** @returns {KnowledgeBase} */
export function currentKB() {
  return kbStorage.getStore() ?? rootKB;
}

/**
 * Run `fn` with a fresh or supplied KB scope. Async-safe across awaits.
 * @overload @param {() => any} fn
 * @overload @param {KnowledgeBase} kb @param {() => any} fn
 */
export function withKB(a, b) {
  const [kb, fn] = typeof a === "function" ? [[], a] : [a, b];
  return kbStorage.run(kb, fn);
}

/** TS-5.2-style disposable scope. `const s = scope(); try {...} finally { s[Symbol.dispose](); }` */
export function scope(kb = []) {
  kbStorage.enterWith(kb);
  return {
    kb,
    [Symbol.dispose]() { kbStorage.disable(); kbStorage.enterWith(rootKB); },
  };
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function isThenable(x) {
  return !!x && typeof x.then === "function";
}

function isLVar(x) {
  return !!x && typeof x === "object" && x.__lvar === true;
}

// -----------------------------------------------------------------------------
// _  : wildcard sentinel | LVar constructor | typed hole
// -----------------------------------------------------------------------------

function _impl(name) {
  if (name === undefined) throw new Error("ALPHABETICA: unfilled hole `_()`");
  return { __lvar: true, name };
}
_impl[WILDCARD] = true;
_impl.rest = (name) => ({ __rest_lvar: true, name });

export const _ = _impl;

function isRestLVar(x) {
  return !!x && typeof x === "object" && x.__rest_lvar === true;
}

// -----------------------------------------------------------------------------
// A  : Assert | Attempt | Apply
// -----------------------------------------------------------------------------

export function A(first, ...rest) {
  if (typeof first === "boolean") {
    if (!first) throw new Error(rest[0] ?? "A: assertion failed");
    return;
  }
  if (typeof first === "function") {
    const treatAsAttempt =
      first.length === 0 && (rest.length === 0 || typeof rest[0] === "string");
    if (treatAsAttempt) {
      try { return first(); }
      catch (e) {
        const msg = typeof rest[0] === "string" ? rest[0] : "A: attempt failed";
        throw new Error(`${msg}: ${String(e)}`, { cause: e });
      }
    }
    return first(...rest);
  }
  throw new TypeError("A: first argument must be boolean or function");
}

// -----------------------------------------------------------------------------
// B  : Branching (pattern match)
// -----------------------------------------------------------------------------

export function B(scrutinee, ...arms) {
  for (const [pattern, handler] of arms) {
    const captures = {};
    if (matchPattern(pattern, scrutinee, captures)) {
      return handler(captures, scrutinee);
    }
  }
  throw new Error("B: no pattern matched and no default arm [_, fn] provided");
}

// B.exhaustive: same runtime as B. Exhaustiveness is a TS-only check in the
// .ts version (via the return-type-poison trick). In JS it's a simple alias.
B.exhaustive = (scrutinee, ...arms) => B(scrutinee, ...arms);

function matchPattern(pattern, value, captures) {
  if (pattern === _ || (typeof pattern === "function" && pattern[WILDCARD])) {
    return true;
  }
  if (pattern && typeof pattern === "object" && pattern.__lvar) {
    captures[pattern.name] = value;
    return true;
  }
  if (typeof pattern === "function") return Boolean(pattern(value));
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) return false;
    return matchArrayPattern(pattern, value, captures);
  }
  if (pattern && typeof pattern === "object" && value && typeof value === "object") {
    for (const key of Object.keys(pattern)) {
      if (!matchPattern(pattern[key], value[key], captures)) return false;
    }
    return true;
  }
  return Object.is(pattern, value);
}

function matchArrayPattern(pattern, value, captures) {
  let restIdx = -1;
  for (let i = 0; i < pattern.length; i++) {
    if (isRestLVar(pattern[i])) {
      if (restIdx !== -1) return false;
      restIdx = i;
    }
  }

  if (restIdx === -1) {
    if (pattern.length !== value.length) return false;
    for (let i = 0; i < pattern.length; i++) {
      if (!matchPattern(pattern[i], value[i], captures)) return false;
    }
    return true;
  }

  const headLen = restIdx;
  const tailLen = pattern.length - restIdx - 1;
  if (value.length < headLen + tailLen) return false;

  for (let i = 0; i < headLen; i++) {
    if (!matchPattern(pattern[i], value[i], captures)) return false;
  }
  const rest = value.slice(headLen, value.length - tailLen);
  captures[pattern[restIdx].name] = rest;
  for (let i = 0; i < tailLen; i++) {
    if (!matchPattern(pattern[restIdx + 1 + i], value[value.length - tailLen + i], captures)) return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// C  : Class | Compose (right-to-left)
// -----------------------------------------------------------------------------

export function C(...args) {
  if (typeof args[0] === "string") return buildClass(args[0], args[1] ?? {});
  const fns = args;
  return (x) => fns.reduceRight((acc, f) => f(acc), x);
}

function buildClass(name, spec) {
  const parent = spec.extends ?? Object;
  const Ctor = new Function("parent", "spec", `
    return class ${name} extends parent {
      constructor(...args) {
        super();
        if (spec.constructor) spec.constructor.apply(this, args);
      }
    }
  `)(parent, spec);
  if (spec.methods) for (const [k, v] of Object.entries(spec.methods)) Ctor.prototype[k] = v;
  if (spec.static)  for (const [k, v] of Object.entries(spec.static))  Ctor[k] = v;
  return Ctor;
}

// -----------------------------------------------------------------------------
// D  : Do | Describe | Document
// -----------------------------------------------------------------------------

const describeStack = [];

export function D(first, second) {
  if (typeof first === "function" && second === undefined) return first();
  if (typeof first === "string" && typeof second === "function") {
    const children = [];
    describeStack.push(children);
    try { second(); } finally { describeStack.pop(); }
    const node = { kind: "describe", label: first, children };
    if (describeStack.length > 0) describeStack[describeStack.length - 1].push(node);
    return node;
  }
  if (typeof first === "string") {
    if (second && typeof second === "object") {
      Object.defineProperty(second, DOC, { value: first, enumerable: false });
    }
    return second;
  }
  throw new TypeError("D: invalid arguments");
}

// -----------------------------------------------------------------------------
// E  : Equals (curried) | Examine (xUnit it-block)
// -----------------------------------------------------------------------------

export function E(a, b) {
  if (arguments.length === 1) return (x) => Object.is(a, x);
  if (typeof a === "string" && typeof b === "function") {
    const node = { kind: "examine", label: a, body: b };
    if (describeStack.length > 0) describeStack[describeStack.length - 1].push(node);
    return node;
  }
  return Object.is(a, b);
}

E.lt = function lt(a, b) { return arguments.length === 1 ? (x) => x < a  : a < b;  };
E.gt = function gt(a, b) { return arguments.length === 1 ? (x) => x > a  : a > b;  };
E.le = function le(a, b) { return arguments.length === 1 ? (x) => x <= a : a <= b; };
E.ge = function ge(a, b) { return arguments.length === 1 ? (x) => x >= a : a >= b; };

// -----------------------------------------------------------------------------
// F  : Fold (left or right) | Facts — async-aware
// -----------------------------------------------------------------------------

export function F(first, second, third) {
  if (typeof first === "string") {
    const terms = Array.from(arguments).slice(1);
    const fact = { __fact: true, relation: first, terms };
    currentKB().push(fact);
    return fact;
  }
  if (Array.isArray(first)) return foldLeft(first, second, third);
  if (typeof first === "function") return foldRight(first, second, third);
  throw new TypeError("F: first arg must be array, function, or string");
}

function foldLeft(arr, init, fn) {
  let acc = init;
  for (let i = 0; i < arr.length; i++) {
    const r = fn(acc, arr[i]);
    if (isThenable(r)) {
      return (async () => {
        let a = await r;
        for (let j = i + 1; j < arr.length; j++) a = await fn(a, arr[j]);
        return a;
      })();
    }
    acc = r;
  }
  return acc;
}

function foldRight(fn, init, arr) {
  let acc = init;
  for (let i = arr.length - 1; i >= 0; i--) {
    const r = fn(arr[i], acc);
    if (isThenable(r)) {
      return (async () => {
        let a = await r;
        for (let j = i - 1; j >= 0; j--) a = await fn(arr[j], a);
        return a;
      })();
    }
    acc = r;
  }
  return acc;
}

// -----------------------------------------------------------------------------
// G  : Given (BDD) | Get (deep property)
// -----------------------------------------------------------------------------

export function G(first, second) {
  if (typeof second === "string") {
    let cur = first;
    for (const key of second.split(".")) {
      if (cur == null) return undefined;
      cur = cur[key];
    }
    return cur;
  }
  const [label, ...rest] = first;
  const states = rest.map((tuple) => {
    const [sLabel, fixture, ...whens] = tuple;
    return { kind: "state", label: sLabel, fixture, whens };
  });
  return { kind: "given", label, states };
}

// -----------------------------------------------------------------------------
// H  : Hashmap | Has
// -----------------------------------------------------------------------------

export function H(first, second) {
  if (arguments.length === 2) return Object.prototype.hasOwnProperty.call(first, second);
  if (first == null) return new Map();
  if (typeof first[Symbol.iterator] === "function") return new Map(first);
  return new Map(Object.entries(first));
}

// -----------------------------------------------------------------------------
// I  : Identity | If
// -----------------------------------------------------------------------------

export function I(a, b, c) {
  return arguments.length === 1 ? a : (a ? b : c);
}

// -----------------------------------------------------------------------------
// J / L : Jump / Label
// -----------------------------------------------------------------------------

class JumpSignal {
  constructor(name, value) { this.name = name; this.value = value; }
}

export function L(name, body) {
  try { return body(); }
  catch (e) {
    if (e instanceof JumpSignal && e.name === name) return e.value;
    throw e;
  }
}

export function J(name, value) {
  throw new JumpSignal(name, value);
}

// -----------------------------------------------------------------------------
// K  : Constant
// -----------------------------------------------------------------------------

export function K(x) { return () => x; }

// -----------------------------------------------------------------------------
// M  : Module
// -----------------------------------------------------------------------------

export function M(name, members, doc) {
  const mod = { ...members };
  Object.defineProperty(mod, MODULE_NAME, { value: name, enumerable: false });
  if (doc !== undefined) {
    Object.defineProperty(mod, MODULE_DOC, { value: doc, enumerable: false });
  }
  return Object.freeze(mod);
}

// -----------------------------------------------------------------------------
// N  : Not / Negate — also constructs anti-facts (NeverGoal) for miniKanren
// -----------------------------------------------------------------------------

/** @typedef {{ readonly __never: true, readonly goal: Fact }} NeverGoal */

function isNeverGoal(x) {
  return !!x && typeof x === "object" && x.__never === true;
}

function isFact(x) {
  return !!x && typeof x === "object" && x.__fact === true;
}

export function N(x) {
  if (isFact(x)) return { __never: true, goal: x };
  return typeof x === "function" ? (...a) => !x(...a) : !x;
}

// -----------------------------------------------------------------------------
// O  : Order (immutable sort)
// -----------------------------------------------------------------------------

export function O(arr, fn) {
  const copy = [...arr];
  if (!fn) return copy.sort();
  if (fn.length >= 2) return copy.sort(fn);
  return copy.sort((a, b) => {
    const ka = fn(a), kb = fn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// -----------------------------------------------------------------------------
// P  : Pipe (left-to-right)
// -----------------------------------------------------------------------------

export function P(...fns) {
  return (x) => fns.reduce((acc, f) => f(acc), x);
}

// -----------------------------------------------------------------------------
// Q  : Quantity
// -----------------------------------------------------------------------------

export function Q(x) {
  if (x == null) return 0;
  if (typeof x === "string" || Array.isArray(x)) return x.length;
  if (x instanceof Map || x instanceof Set) return x.size;
  if (typeof x === "object") return Object.keys(x).length;
  throw new TypeError("Q: unsupported type");
}

// -----------------------------------------------------------------------------
// R  : Require | Refute | Read / Write / Append
// -----------------------------------------------------------------------------

export async function R(first, second) {
  if (typeof first === "boolean") {
    if (first) throw new Error(second ?? "R: refutation failed");
    return;
  }
  if (typeof first !== "string") throw new TypeError("R: first arg must be string or boolean");
  if (second && typeof second === "object" && ("write" in second || "append" in second)) {
    const { promises: fs } = await import("node:fs");
    if ("write" in second) return fs.writeFile(first, second.write);
    return fs.appendFile(first, second.append);
  }
  const looksLikeModule =
    /\.(m|c)?[jt]sx?$/.test(first) || (!first.includes("/") && !first.includes("."));
  if (looksLikeModule && (second === undefined ||
      (typeof second === "string" && /^(file|https?):\/\//.test(second)))) {
    if (typeof second === "string" && first.startsWith(".")) {
      const resolved = new URL(first, second).href;
      return import(resolved);
    }
    return import(first);
  }
  const { promises: fs } = await import("node:fs");
  if (typeof second === "string") return fs.readFile(first, second);
  return fs.readFile(first);
}

// -----------------------------------------------------------------------------
// S  : Set | Solve (miniKanren-lite over currentKB)
// -----------------------------------------------------------------------------

export function S(arg) {
  if (arg === undefined) return new Set();
  if (Array.isArray(arg) && arg.length > 0 && (isFact(arg[0]) || isNeverGoal(arg[0]))) {
    return solve(arg);
  }
  return new Set(arg);
}

function solve(goals) {
  const kb = currentKB();
  let subs = [{}];
  for (const g of goals) {
    const next = [];
    if (isNeverGoal(g)) {
      for (const sub of subs) {
        const inner = solveOne(g.goal, sub, kb);
        if (inner.length === 0) next.push(sub);
      }
    } else {
      for (const sub of subs) {
        for (const s of solveOne(g, sub, kb)) next.push(s);
      }
    }
    subs = next;
    if (subs.length === 0) break;
  }
  return subs;
}

function solveOne(g, sub, kb) {
  const out = [];
  for (const fact of kb) {
    if (fact.relation !== g.relation) continue;
    if (fact.terms.length !== g.terms.length) continue;
    const merged = unifyTerms(g.terms, fact.terms, sub);
    if (merged) out.push(merged);
  }
  return out;
}

function unifyTerms(a, b, sub) {
  let cur = sub;
  for (let i = 0; i < a.length; i++) {
    const next = unifyOne(a[i], b[i], cur);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function unifyOne(a, b, sub) {
  const aw = walk(a, sub), bw = walk(b, sub);
  if (isLVar(aw) && isLVar(bw) && aw.name === bw.name) return sub;
  if (isLVar(aw)) return { ...sub, [aw.name]: bw };
  if (isLVar(bw)) return { ...sub, [bw.name]: aw };
  return Object.is(aw, bw) ? sub : null;
}

function walk(x, sub) {
  while (isLVar(x) && x.name in sub) x = sub[x.name];
  return x;
}

/** Build a goal (Fact-shaped) without asserting into the KB. */
export function goal(relation, ...terms) {
  return { __fact: true, relation, terms };
}

// -----------------------------------------------------------------------------
// T  : Then (BDD) | Tap
// -----------------------------------------------------------------------------

export function T(first, second) {
  if (typeof first === "function") return (x) => { first(x); return x; };
  return { kind: "then", label: first, check: second };
}

// -----------------------------------------------------------------------------
// U  : Unfold | Until — async-aware on Until
// -----------------------------------------------------------------------------

export function U(first, second, third) {
  if (typeof first === "function") {
    let iters = 0;
    const cap = third ?? 1_000_000;
    const loop = () => {
      while (true) {
        if (iters++ > cap) throw new Error("U: max iterations exceeded");
        const c = first();
        if (isThenable(c)) {
          return (async () => {
            if (await c) return;
            await second();
            return loop();
          })();
        }
        if (c) return;
        const r = second();
        if (isThenable(r)) return (async () => { await r; return loop(); })();
      }
    };
    return loop();
  }
  const seed = first, step = second;
  return {
    *[Symbol.iterator]() {
      let s = seed;
      while (true) {
        const r = step(s);
        if (r == null) return;
        const [value, next] = r; yield value; s = next;
      }
    },
  };
}

// -----------------------------------------------------------------------------
// V  : Values (let-in bindings)
// -----------------------------------------------------------------------------

export function V(bindings, body) { return body(bindings); }

// -----------------------------------------------------------------------------
// W  : When (BDD) | While — async-aware
// -----------------------------------------------------------------------------

export function W(first, second, third) {
  if (typeof first === "function") {
    let iters = 0;
    const cap = third ?? 1_000_000;
    const loop = () => {
      while (true) {
        if (iters++ > cap) throw new Error("W: max iterations exceeded");
        const c = first();
        if (isThenable(c)) {
          return (async () => {
            if (!(await c)) return;
            await second();
            return loop();
          })();
        }
        if (!c) return;
        const r = second();
        if (isThenable(r)) return (async () => { await r; return loop(); })();
      }
    };
    return loop();
  }
  return { kind: "when", label: first, then: second };
}

// -----------------------------------------------------------------------------
// X  : eXecute (shell via tagged template) | eXamine facts (query)
// -----------------------------------------------------------------------------

export function X(first, ...rest) {
  if (Array.isArray(first) && "raw" in first) return executeShell(first, rest, "/bin/bash");
  // 1-arg form: count any fact with this relation regardless of arity.
  if (rest.length === 0) {
    const kb = currentKB();
    const out = [];
    for (const fact of kb) if (fact.relation === first) out.push({});
    return out;
  }
  return solve([{ __fact: true, relation: first, terms: rest }]);
}

async function executeShell(strings, values, shell) {
  let cmd = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) cmd += shellEscape(String(values[i])) + (strings[i + 1] ?? "");
  const { promisify } = await import("node:util");
  const { exec } = await import("node:child_process");
  const pExec = promisify(exec);
  const { stdout } = await pExec(cmd, { shell });
  return stdout;
}

function shellEscape(s) { return `'${s.replace(/'/g, `'\\''`)}'`; }

X.zsh = (strings, ...values) => executeShell(strings, values, "/bin/zsh");
X.sh  = (strings, ...values) => executeShell(strings, values, "/bin/sh");

// -----------------------------------------------------------------------------
// Y  : Bounce / Trampoline — async-aware
// -----------------------------------------------------------------------------

function unwrapY(fn) {
  return fn?.[Y_ORIGINAL] ?? fn;
}

export function Y(fn) {
  const wrapped = (...args) => {
    let current = { fn, args };
    while (true) {
      const result = current.fn(...current.args);
      if (isThenable(result)) {
        return (async () => {
          let r = await result;
          while (r && typeof r === "object" && r[BOUNCE]) {
            const inner = unwrapY(r.fn);
            r = await inner(...r.args);
          }
          return r;
        })();
      }
      if (result && typeof result === "object" && result[BOUNCE]) {
        current = { fn: unwrapY(result.fn), args: result.args };
        continue;
      }
      return result;
    }
  };
  wrapped[Y_ORIGINAL] = fn;
  return wrapped;
}

Y.bounce = (fn, ...args) => ({ [BOUNCE]: true, fn, args });

// -----------------------------------------------------------------------------
// Z  : Zip
// -----------------------------------------------------------------------------

export function Z(...arrs) {
  const len = Math.min(...arrs.map((a) => a.length));
  const out = [];
  for (let i = 0; i < len; i++) out.push(arrs.map((a) => a[i]));
  return out;
}

// =============================================================================
// Runner + Reporters
// =============================================================================

/**
 * @typedef {"passed" | "failed" | "skipped"} TestStatus
 * @typedef {"given" | "state" | "when" | "then" | "inherit"} ScopeGranularity
 * @typedef {"pretty" | "tap" | "junit" | "null"} ReporterName
 */

export async function run(tree, opts = {}) {
  const trees = Array.isArray(tree) ? tree : [tree];
  const results = [];
  const kbScope = opts.kbScope ?? "then";
  const write = opts.write ?? ((s) => process.stdout.write(s));
  const reporter = opts.silent ? nullReporter : resolveReporter(opts.reporter ?? "pretty");
  const start = performance.now();
  const rCtx = { write, startedAt: start };

  reporter.onRunStart?.(rCtx);

  for (const t of trees) {
    await runNode(t, [], results, { kbScope, filter: opts.filter, reporter, rCtx });
  }

  const passed  = results.filter(r => r.status === "passed").length;
  const failed  = results.filter(r => r.status === "failed").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const durationMs = performance.now() - start;
  const report = { passed, failed, skipped, durationMs, results };

  reporter.onRunEnd?.(report, rCtx);
  return report;
}

async function runNode(node, path, results, ctx) {
  switch (node.kind) {
    case "describe": {
      const p = [...path, node.label];
      ctx.reporter.onSuiteEnter?.(node, p, ctx.rCtx);
      for (const child of node.children) await runNode(child, p, results, ctx);
      return;
    }
    case "examine": {
      const p = [...path, node.label];
      if (ctx.filter && !ctx.filter(p)) {
        const r = { path: p, status: "skipped", durationMs: 0 };
        results.push(r);
        ctx.reporter.onResult?.(r, ctx.rCtx);
        return;
      }
      await executeCheck(p, () => node.body(), results, ctx);
      return;
    }
    case "given": {
      const p = [...path, `Given ${node.label}`];
      ctx.reporter.onSuiteEnter?.(node, p, ctx.rCtx);
      const wrap = ctx.kbScope === "given" ? (fn) => withKB([], fn) : (fn) => fn();
      await wrap(async () => {
        for (const state of node.states) await runState(state, p, results, ctx);
      });
      return;
    }
  }
}

async function runState(state, path, results, ctx) {
  const p = [...path, state.label];
  ctx.reporter.onSuiteEnter?.({ kind: "describe", label: state.label, children: [] }, p, ctx.rCtx);
  const wrap = ctx.kbScope === "state" ? (fn) => withKB([], fn) : (fn) => fn();
  await wrap(async () => {
    for (const when of state.whens) {
      const wp = [...p, `When ${when.label}`];
      ctx.reporter.onSuiteEnter?.({ kind: "describe", label: `When ${when.label}`, children: [] }, wp, ctx.rCtx);
      const whenWrap = ctx.kbScope === "when" ? (fn) => withKB([], fn) : (fn) => fn();
      await whenWrap(async () => {
        const tp = [...wp, `Then ${when.then.label}`];
        if (ctx.filter && !ctx.filter(tp)) {
          const r = { path: tp, status: "skipped", durationMs: 0 };
          results.push(r);
          ctx.reporter.onResult?.(r, ctx.rCtx);
          return;
        }
        const exec = () => when.then.check(state.fixture);
        if (ctx.kbScope === "then") {
          await withKB([], () => executeCheck(tp, exec, results, ctx));
        } else {
          await executeCheck(tp, exec, results, ctx);
        }
      });
    }
  });
}

async function executeCheck(path, exec, results, ctx) {
  const t0 = performance.now();
  try {
    const r = exec();
    if (isThenable(r)) await r;
    const durationMs = performance.now() - t0;
    const result = { path, status: "passed", durationMs };
    results.push(result);
    ctx.reporter.onResult?.(result, ctx.rCtx);
  } catch (e) {
    const durationMs = performance.now() - t0;
    const error = e instanceof Error ? e : new Error(String(e));
    const result = { path, status: "failed", error, durationMs };
    results.push(result);
    ctx.reporter.onResult?.(result, ctx.rCtx);
  }
}

// -----------------------------------------------------------------------------
// Built-in reporters
// -----------------------------------------------------------------------------

function resolveReporter(r) {
  if (typeof r !== "string") return r;
  switch (r) {
    case "pretty": return prettyReporter;
    case "tap":    return tapReporter;
    case "junit":  return junitReporter;
    case "null":   return nullReporter;
  }
}

export const nullReporter = { name: "null" };

export const prettyReporter = {
  name: "pretty",
  onSuiteEnter(_node, path, ctx) {
    const indent = "  ".repeat(path.length - 1);
    ctx.write(`${indent}${path[path.length - 1]}\n`);
  },
  onResult(result, ctx) {
    const indent = "  ".repeat(result.path.length);
    const mark = result.status === "passed" ? "\u2713"
               : result.status === "failed" ? "\u2717"
               : "\u25CB";
    const label = result.path[result.path.length - 1];
    const duration = result.status === "skipped" ? "" : `  (${result.durationMs.toFixed(1)}ms)`;
    ctx.write(`${indent}${mark} ${label}${duration}\n`);
    if (result.status === "failed" && result.error) {
      ctx.write(`${indent}  ${result.error.message}\n`);
    }
  },
  onRunEnd(report, ctx) {
    ctx.write(`\n${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped  (${report.durationMs.toFixed(1)}ms)\n`);
  },
};

export const tapReporter = {
  name: "tap",
  onRunStart(ctx) { ctx.write(`TAP version 14\n`); },
  onResult(result, ctx) {
    tapReporter._n = (tapReporter._n ?? 0) + 1;
    const n = tapReporter._n;
    const label = result.path.join(" > ");
    if (result.status === "passed") {
      ctx.write(`ok ${n} - ${label}\n`);
    } else if (result.status === "skipped") {
      ctx.write(`ok ${n} - ${label} # SKIP\n`);
    } else {
      ctx.write(`not ok ${n} - ${label}\n`);
      if (result.error) {
        ctx.write(`  ---\n`);
        ctx.write(`  message: ${JSON.stringify(result.error.message)}\n`);
        ctx.write(`  severity: fail\n`);
        ctx.write(`  ...\n`);
      }
    }
  },
  onRunEnd(report, ctx) {
    const total = report.passed + report.failed + report.skipped;
    ctx.write(`1..${total}\n`);
    ctx.write(`# tests ${total}\n# pass  ${report.passed}\n# fail  ${report.failed}\n# skip  ${report.skipped}\n`);
    tapReporter._n = 0;
  },
};

export const junitReporter = {
  name: "junit",
  onRunStart(ctx) { ctx.write(`<?xml version="1.0" encoding="UTF-8"?>\n`); },
  onRunEnd(report, ctx) {
    const total = report.passed + report.failed + report.skipped;
    const time = (report.durationMs / 1000).toFixed(3);
    ctx.write(`<testsuite name="alphabetica" tests="${total}" failures="${report.failed}" skipped="${report.skipped}" time="${time}">\n`);
    for (const r of report.results) {
      const name = escXml(r.path.join(" > "));
      const t = (r.durationMs / 1000).toFixed(3);
      if (r.status === "passed") {
        ctx.write(`  <testcase name="${name}" time="${t}"/>\n`);
      } else if (r.status === "skipped") {
        ctx.write(`  <testcase name="${name}" time="${t}"><skipped/></testcase>\n`);
      } else {
        const msg = escXml(r.error?.message ?? "failed");
        ctx.write(`  <testcase name="${name}" time="${t}"><failure message="${msg}"/></testcase>\n`);
      }
    }
    ctx.write(`</testsuite>\n`);
  },
};

function escXml(s) {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
}

// =============================================================================
// Namespace export
// =============================================================================

export const ALPHABETICA = Object.freeze({
  _, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
  run, withKB, scope, currentKB, goal,
  prettyReporter, tapReporter, junitReporter, nullReporter,
  MODULE_NAME, MODULE_DOC, DOC, WILDCARD, BOUNCE,
});


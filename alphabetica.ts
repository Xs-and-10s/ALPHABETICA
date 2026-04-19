// =============================================================================
// ALPHABETICA v0.2.0-alpha
// =============================================================================
// Changes from v0.1:
//   - AsyncLocalStorage-based KB scoping (withKB / scope / currentKB)
//   - ALPHABETICA.run() test runner for BDD and xUnit trees
//   - Async detection on F (fold), W (while), U (until/unfold), Y (trampoline)
//   - Upgraded B pattern inference: LVars carry names in types; captures are
//     correctly typed from structural patterns
//   - ThenNode.check now receives an optional fixture argument
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { AsyncLocalStorage } from "node:async_hooks";

// -----------------------------------------------------------------------------
// Core types
// -----------------------------------------------------------------------------

type AnyFn = (...args: any[]) => any;

export const MODULE_NAME: unique symbol = Symbol("ALPHABETICA.moduleName");
export const MODULE_DOC:  unique symbol = Symbol("ALPHABETICA.moduleDoc");
export const DOC:         unique symbol = Symbol("ALPHABETICA.doc");
export const WILDCARD:    unique symbol = Symbol("ALPHABETICA.wildcard");
export const BOUNCE:      unique symbol = Symbol("ALPHABETICA.bounce");

/** Logic variable; carries its name in the type for inference. */
export interface LVar<N extends string = string> {
  readonly __lvar: true;
  readonly name: N;
}

export interface Fact {
  readonly __fact: true;
  readonly relation: string;
  readonly terms: readonly unknown[];
}

export type Substitution = Readonly<Record<string, unknown>>;

/** Pattern for B. Narrowed by structural keys when possible. */
export type Pattern<T = unknown> =
  | T
  | LVar
  | typeof _
  | ((value: T) => boolean)
  | { readonly [K in keyof T]?: Pattern<T[K]> };

/** Extract capture bindings from a pattern matched against a scrutinee type. */
export type ExtractCaptures<P, S> =
  P extends LVar<infer N>
    ? Record<N, S>
  : P extends readonly any[]
    ? {} // TODO(v0.3): array/tuple patterns
  : P extends object
    ? S extends object
      ? UnionToIntersection<
          {
            [K in keyof P]: K extends keyof S
              ? ExtractCaptures<P[K], S[K]>
              : {};
          }[keyof P]
        > extends infer I
          ? { [K in keyof I]: I[K] }
          : never
      : {}
  : {};

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I : never;

/** Trampoline continuation. */
export interface Bounce<A extends readonly any[] = readonly any[]> {
  readonly [BOUNCE]: true;
  readonly fn: (...args: A) => any;
  readonly args: A;
}

// --- BDD tree (Gherkin-style) ---
export interface ThenNode<Fix = unknown> {
  readonly kind: "then";
  readonly label: string;
  readonly check: (fixture: Fix) => void | Promise<void>;
}
export interface WhenNode<Fix = unknown> {
  readonly kind: "when";
  readonly label: string;
  readonly then: ThenNode<Fix>;
}
export type StateTuple<Fix = any> =
  readonly [label: string, fixture: Fix, ...whens: WhenNode<Fix>[]];
export interface StateNode<Fix = unknown> {
  readonly kind: "state";
  readonly label: string;
  readonly fixture: Fix;
  readonly whens: readonly WhenNode<Fix>[];
}
export interface GivenNode {
  readonly kind: "given";
  readonly label: string;
  readonly states: readonly StateNode[];
}

// --- xUnit tree (describe/examine) ---
export interface ExamineNode {
  readonly kind: "examine";
  readonly label: string;
  readonly body: () => void | Promise<void>;
}
export interface DescribeNode {
  readonly kind: "describe";
  readonly label: string;
  readonly children: readonly (DescribeNode | ExamineNode)[];
}

export type TestNode = GivenNode | DescribeNode | ExamineNode;

export type Module<N extends string, Members extends Record<string, unknown>> =
  Readonly<Members> & {
    readonly [MODULE_NAME]: N;
    readonly [MODULE_DOC]?: string;
  };

// -----------------------------------------------------------------------------
// Knowledge base scoping (AsyncLocalStorage)
// -----------------------------------------------------------------------------

export type KnowledgeBase = Fact[];

const kbStorage = new AsyncLocalStorage<KnowledgeBase>();
const rootKB: KnowledgeBase = [];

/** Returns the KB active in the current async scope, or the root KB. */
export function currentKB(): KnowledgeBase {
  return kbStorage.getStore() ?? rootKB;
}

/** Run `fn` with a fresh or supplied KB scope. Async-safe across awaits. */
export function withKB<R>(fn: () => R): R;
export function withKB<R>(kb: KnowledgeBase, fn: () => R): R;
export function withKB<R>(a: KnowledgeBase | (() => R), b?: () => R): R {
  const [kb, fn] = typeof a === "function"
    ? [[] as KnowledgeBase, a as () => R]
    : [a, b!];
  return kbStorage.run(kb, fn);
}

/** TS 5.2+ disposable scope. Usage: `using s = scope();`. */
export function scope(kb: KnowledgeBase = []): Disposable & { kb: KnowledgeBase } {
  kbStorage.enterWith(kb);
  return {
    kb,
    [Symbol.dispose]() { kbStorage.disable(); kbStorage.enterWith(rootKB); },
  };
}

// -----------------------------------------------------------------------------
// Utility: async detection for loop/fold/trampoline bodies
// -----------------------------------------------------------------------------

function isThenable(x: unknown): x is PromiseLike<unknown> {
  return !!x && typeof (x as any).then === "function";
}

// -----------------------------------------------------------------------------
// _  : wildcard sentinel | LVar constructor | typed hole
// -----------------------------------------------------------------------------

function _impl<N extends string>(name: N): LVar<N>;
function _impl(): never;
function _impl(name?: string): LVar | never {
  if (name === undefined) throw new Error("ALPHABETICA: unfilled hole `_()`");
  return { __lvar: true, name };
}
(_impl as any)[WILDCARD] = true;

export const _: {
  <N extends string>(name: N): LVar<N>;
  (): never;
  readonly [WILDCARD]: true;
} = _impl as any;

// -----------------------------------------------------------------------------
// A  : Assert | Attempt | Apply
// -----------------------------------------------------------------------------

export function A(condition: boolean, message?: string): asserts condition;
export function A<R>(thunk: () => R, message?: string): R;
export function A<Args extends readonly any[], R>(
  fn: (...args: Args) => R,
  ...args: Args
): R;
export function A(first: any, ...rest: any[]): any {
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
// B  : Branching (pattern match) — with capture inference
// -----------------------------------------------------------------------------
//
// B uses overloads up to arity 8 so each arm's pattern `P` flows into a per-arm
// generic. Mapped-tuple encodings (`[K in keyof Arms]: ...`) widen to the
// constraint bound in TS 5.x, which destroys capture inference — hence the
// explicit overloads below. For >8 arms, the rest overload catches them with
// looser (but still correct) types.
// -----------------------------------------------------------------------------

type Arm<P, S, R> = readonly [P, (captures: ExtractCaptures<P, S>) => R];

export function B<S, P1, R1>(
  scrutinee: S,
  a1: Arm<P1, S, R1>,
): R1;
export function B<S, P1, R1, P2, R2>(
  scrutinee: S,
  a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>,
): R1 | R2;
export function B<S, P1, R1, P2, R2, P3, R3>(
  scrutinee: S,
  a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>,
): R1 | R2 | R3;
export function B<S, P1, R1, P2, R2, P3, R3, P4, R4>(
  scrutinee: S,
  a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>,
): R1 | R2 | R3 | R4;
export function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5>(
  scrutinee: S,
  a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>,
): R1 | R2 | R3 | R4 | R5;
export function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5, P6, R6>(
  scrutinee: S,
  a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>, a6: Arm<P6, S, R6>,
): R1 | R2 | R3 | R4 | R5 | R6;
export function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5, P6, R6, P7, R7>(
  scrutinee: S,
  a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>, a6: Arm<P6, S, R6>, a7: Arm<P7, S, R7>,
): R1 | R2 | R3 | R4 | R5 | R6 | R7;
export function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5, P6, R6, P7, R7, P8, R8>(
  scrutinee: S,
  a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>, a6: Arm<P6, S, R6>, a7: Arm<P7, S, R7>, a8: Arm<P8, S, R8>,
): R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8;
// Fallback for >8 arms: looser types
export function B<S, R>(
  scrutinee: S,
  ...arms: readonly (readonly [unknown, (captures: Record<string, unknown>) => R])[]
): R;
export function B(scrutinee: any, ...arms: readonly (readonly [unknown, AnyFn])[]): any {
  for (const [pattern, handler] of arms) {
    const captures: Record<string, unknown> = {};
    if (matchPattern(pattern, scrutinee, captures)) {
      return (handler as AnyFn)(captures);
    }
  }
  throw new Error("B: no pattern matched and no default arm [_, fn] provided");
}

function matchPattern(
  pattern: unknown,
  value: unknown,
  captures: Record<string, unknown>,
): boolean {
  if (pattern === _ || (typeof pattern === "function" && (pattern as any)[WILDCARD])) {
    return true;
  }
  if (pattern && typeof pattern === "object" && (pattern as LVar).__lvar) {
    captures[(pattern as LVar).name] = value;
    return true;
  }
  if (typeof pattern === "function") return Boolean(pattern(value));
  if (pattern && typeof pattern === "object" && value && typeof value === "object") {
    for (const key of Object.keys(pattern as object)) {
      if (!matchPattern((pattern as any)[key], (value as any)[key], captures)) return false;
    }
    return true;
  }
  return Object.is(pattern, value);
}

// -----------------------------------------------------------------------------
// C  : Class | Compose (right-to-left)
// -----------------------------------------------------------------------------

export interface ClassSpec<P extends object = object> {
  readonly constructor?: (this: P, ...args: any[]) => void;
  readonly methods?: Readonly<Record<string, AnyFn>>;
  readonly static?: Readonly<Record<string, unknown>>;
  readonly extends?: new (...args: any[]) => object;
}

export function C<N extends string, P extends object = object>(
  name: N, spec: ClassSpec<P>,
): new (...args: any[]) => P;
export function C<A, B>(f: (a: A) => B): (a: A) => B;
export function C<A, B, CC>(f: (b: B) => CC, g: (a: A) => B): (a: A) => CC;
export function C<A, B, CC, D>(f: (c: CC) => D, g: (b: B) => CC, h: (a: A) => B): (a: A) => D;
export function C<A, B, CC, D, E>(f: (d: D) => E, g: (c: CC) => D, h: (b: B) => CC, i: (a: A) => B): (a: A) => E;
export function C(...args: any[]): any {
  if (typeof args[0] === "string") return buildClass(args[0], args[1] ?? {});
  const fns = args as AnyFn[];
  return (x: unknown) => fns.reduceRight((acc, f) => f(acc), x);
}

function buildClass(name: string, spec: ClassSpec): any {
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

export function D<R>(fn: () => R): R;
export function D(label: string, body: () => void): DescribeNode;
export function D<T>(doc: string, value: T): T & { readonly [DOC]: string };
export function D(first: any, second?: any): any {
  if (typeof first === "function" && second === undefined) return first();
  if (typeof first === "string" && typeof second === "function") {
    const children: (DescribeNode | ExamineNode)[] = [];
    describeStack.push(children);
    try { second(); } finally { describeStack.pop(); }
    const node: DescribeNode = { kind: "describe", label: first, children };
    if (describeStack.length > 0) describeStack[describeStack.length - 1]!.push(node);
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

const describeStack: (DescribeNode | ExamineNode)[][] = [];

// -----------------------------------------------------------------------------
// E  : Equals (curried) | Examine (xUnit it-block)
// -----------------------------------------------------------------------------

export function E<T>(a: T, b: T): boolean;
export function E<T>(a: T): (b: T) => boolean;
export function E(label: string, body: () => void | Promise<void>): ExamineNode;
export function E(a: any, b?: any): any {
  if (arguments.length === 1) return (x: unknown) => Object.is(a, x);
  if (typeof a === "string" && typeof b === "function") {
    const node: ExamineNode = { kind: "examine", label: a, body: b };
    if (describeStack.length > 0) describeStack[describeStack.length - 1]!.push(node);
    return node;
  }
  return Object.is(a, b);
}

// -----------------------------------------------------------------------------
// F  : Fold (left or right) | Facts — async-aware
// -----------------------------------------------------------------------------

export function F<T, U>(arr: readonly T[], init: U, fn: (acc: U, x: T) => U): U;
export function F<T, U>(arr: readonly T[], init: U, fn: (acc: U, x: T) => Promise<U>): Promise<U>;
export function F<T, U>(arr: readonly T[], init: U, fn: (acc: U, x: T) => U | Promise<U>): U | Promise<U>;
export function F<T, U>(fn: (x: T, acc: U) => U, init: U, arr: readonly T[]): U;
export function F<T, U>(fn: (x: T, acc: U) => Promise<U>, init: U, arr: readonly T[]): Promise<U>;
export function F<T, U>(fn: (x: T, acc: U) => U | Promise<U>, init: U, arr: readonly T[]): U | Promise<U>;
export function F(relation: string, ...terms: readonly unknown[]): Fact;
export function F(first: any, second?: any, third?: any): any {
  if (typeof first === "string") {
    const terms = Array.from(arguments).slice(1);
    const fact: Fact = { __fact: true, relation: first, terms };
    currentKB().push(fact);
    return fact;
  }
  if (Array.isArray(first)) return foldLeft(first, second, third);
  if (typeof first === "function") return foldRight(first, second, third);
  throw new TypeError("F: first arg must be array, function, or string");
}

function foldLeft(arr: readonly any[], init: any, fn: (a: any, x: any) => any): any {
  let acc: any = init;
  for (let i = 0; i < arr.length; i++) {
    const r = fn(acc, arr[i]!);
    if (isThenable(r)) {
      return (async () => {
        let a: any = await r;
        for (let j = i + 1; j < arr.length; j++) a = await fn(a, arr[j]!);
        return a;
      })();
    }
    acc = r;
  }
  return acc;
}

function foldRight(fn: (x: any, a: any) => any, init: any, arr: readonly any[]): any {
  let acc: any = init;
  for (let i = arr.length - 1; i >= 0; i--) {
    const r = fn(arr[i]!, acc);
    if (isThenable(r)) {
      return (async () => {
        let a: any = await r;
        for (let j = i - 1; j >= 0; j--) a = await fn(arr[j]!, a);
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

export function G(
  tree: readonly [label: string, ...states: StateTuple[]],
): GivenNode;
export function G<T>(obj: T, path: string): unknown;
export function G(first: any, second?: any): any {
  if (typeof second === "string") {
    let cur: any = first;
    for (const key of second.split(".")) {
      if (cur == null) return undefined;
      cur = cur[key];
    }
    return cur;
  }
  const [label, ...rest] = first as readonly unknown[];
  const states: StateNode[] = rest.map((tuple) => {
    const [sLabel, fixture, ...whens] = tuple as StateTuple;
    return { kind: "state", label: sLabel, fixture, whens: whens as WhenNode[] };
  });
  return { kind: "given", label: label as string, states };
}

// -----------------------------------------------------------------------------
// H  : Hashmap | Has
// -----------------------------------------------------------------------------

export function H(): Map<unknown, unknown>;
export function H<K, V>(entries: Iterable<readonly [K, V]>): Map<K, V>;
export function H<V>(obj: Record<string, V>): Map<string, V>;
export function H<T extends object>(obj: T, key: PropertyKey): boolean;
export function H(first?: any, second?: any): any {
  if (arguments.length === 2) return Object.prototype.hasOwnProperty.call(first, second);
  if (first == null) return new Map();
  if (typeof (first as any)[Symbol.iterator] === "function") return new Map(first);
  return new Map(Object.entries(first));
}

// -----------------------------------------------------------------------------
// I  : Identity | If
// -----------------------------------------------------------------------------

export function I<T>(x: T): T;
export function I<T, U>(cond: unknown, thn: T, els: U): T | U;
export function I(a: any, b?: any, c?: any): any {
  return arguments.length === 1 ? a : (a ? b : c);
}

// -----------------------------------------------------------------------------
// J / L : Jump / Label
// -----------------------------------------------------------------------------

class JumpSignal {
  constructor(readonly name: string, readonly value: unknown) {}
}

export function L<R>(name: string, body: () => R): R {
  try { return body(); }
  catch (e) {
    if (e instanceof JumpSignal && e.name === name) return e.value as R;
    throw e;
  }
}

export function J(name: string, value?: unknown): never {
  throw new JumpSignal(name, value);
}

// -----------------------------------------------------------------------------
// K  : Constant
// -----------------------------------------------------------------------------

export function K<T>(x: T): () => T { return () => x; }

// -----------------------------------------------------------------------------
// M  : Module
// -----------------------------------------------------------------------------

export function M<N extends string, Members extends Record<string, unknown>>(
  name: N, members: Members, doc?: string,
): Module<N, Members> {
  const mod = { ...members } as Module<N, Members>;
  Object.defineProperty(mod, MODULE_NAME, { value: name, enumerable: false });
  if (doc !== undefined) {
    Object.defineProperty(mod, MODULE_DOC, { value: doc, enumerable: false });
  }
  return Object.freeze(mod);
}

// -----------------------------------------------------------------------------
// N  : Not / Negate — also constructs anti-facts (NeverGoal) for miniKanren
// -----------------------------------------------------------------------------
// N(bool)                      → !bool
// N(predicate)                 → negated predicate
// N(Fact)                      → NeverGoal; inside S([...]), succeeds iff the
//                                inner fact fails to unify against the KB
//                                under the current substitution.
// Discrimination: Fact (has __fact === true) → NeverGoal; function → negate;
// else boolean negation.
// -----------------------------------------------------------------------------

/** An anti-fact: in a goal list, succeeds iff the inner goal is unprovable. */
export interface NeverGoal {
  readonly __never: true;
  readonly goal: Fact;
}

function isNeverGoal(x: unknown): x is NeverGoal {
  return !!x && typeof x === "object" && (x as NeverGoal).__never === true;
}

function isFact(x: unknown): x is Fact {
  return !!x && typeof x === "object" && (x as Fact).__fact === true;
}

export function N(goal: Fact): NeverGoal;
export function N(x: boolean): boolean;
export function N<A extends readonly any[]>(pred: (...args: A) => boolean): (...args: A) => boolean;
export function N(x: any): any {
  if (isFact(x)) return { __never: true, goal: x } as NeverGoal;
  return typeof x === "function" ? (...a: any[]) => !x(...a) : !x;
}

// -----------------------------------------------------------------------------
// O  : Order (immutable sort)
// -----------------------------------------------------------------------------

export function O<T>(arr: readonly T[]): T[];
export function O<T>(arr: readonly T[], cmp: (a: T, b: T) => number): T[];
export function O<T, K extends string | number | bigint>(arr: readonly T[], key: (t: T) => K): T[];
export function O<T>(arr: readonly T[], fn?: AnyFn): T[] {
  const copy = [...arr];
  if (!fn) return copy.sort();
  if (fn.length >= 2) return copy.sort(fn as any);
  return copy.sort((a, b) => {
    const ka = fn(a), kb = fn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// -----------------------------------------------------------------------------
// P  : Pipe (left-to-right)
// -----------------------------------------------------------------------------

export function P<A, B>(f: (a: A) => B): (a: A) => B;
export function P<A, B, CC>(f: (a: A) => B, g: (b: B) => CC): (a: A) => CC;
export function P<A, B, CC, D>(f: (a: A) => B, g: (b: B) => CC, h: (c: CC) => D): (a: A) => D;
export function P<A, B, CC, D, E>(f: (a: A) => B, g: (b: B) => CC, h: (c: CC) => D, i: (d: D) => E): (a: A) => E;
export function P(...fns: AnyFn[]): AnyFn {
  return (x: unknown) => fns.reduce((acc, f) => f(acc), x);
}

// -----------------------------------------------------------------------------
// Q  : Quantity
// -----------------------------------------------------------------------------

export function Q(x: string): number;
export function Q<T>(x: readonly T[]): number;
export function Q<K, V>(x: Map<K, V>): number;
export function Q<T>(x: Set<T>): number;
export function Q(x: object): number;
export function Q(x: any): number {
  if (x == null) return 0;
  if (typeof x === "string" || Array.isArray(x)) return x.length;
  if (x instanceof Map || x instanceof Set) return x.size;
  if (typeof x === "object") return Object.keys(x).length;
  throw new TypeError("Q: unsupported type");
}

// -----------------------------------------------------------------------------
// R  : Require | Refute | Read / Write / Append
// -----------------------------------------------------------------------------

type RWOpts = { readonly write: string | Uint8Array } | { readonly append: string | Uint8Array };

export function R(condition: boolean, message?: string): asserts condition is false;
export function R<T = unknown>(spec: string): Promise<T>;
export function R(path: string, encoding: BufferEncoding): Promise<string>;
export function R(path: string, opts: RWOpts): Promise<void>;
export async function R(first: any, second?: any): Promise<any> {
  if (typeof first === "boolean") {
    if (first) throw new Error(second ?? "R: refutation failed");
    return;
  }
  if (typeof first !== "string") throw new TypeError("R: first arg must be string or boolean");
  if (second && typeof second === "object" && ("write" in second || "append" in second)) {
    const { promises: fs } = await import("node:fs");
    if ("write" in second) return fs.writeFile(first, second.write as any);
    return fs.appendFile(first, second.append as any);
  }
  const looksLikeModule =
    /\.(m|c)?[jt]sx?$/.test(first) || (!first.includes("/") && !first.includes("."));
  if (looksLikeModule && second === undefined) return import(first);
  const { promises: fs } = await import("node:fs");
  if (typeof second === "string") return fs.readFile(first, second as BufferEncoding);
  return fs.readFile(first);
}

// -----------------------------------------------------------------------------
// S  : Set | Solve (miniKanren-lite over currentKB)
// -----------------------------------------------------------------------------

export function S(goals: readonly (Fact | NeverGoal)[]): Substitution[];
export function S<T>(items?: Iterable<T>): Set<T>;
export function S(arg?: any): any {
  if (arg === undefined) return new Set();
  if (Array.isArray(arg) && arg.length > 0 && (isFact(arg[0]) || isNeverGoal(arg[0]))) {
    return solve(arg as readonly (Fact | NeverGoal)[]);
  }
  return new Set(arg);
}

function solve(goals: readonly (Fact | NeverGoal)[]): Substitution[] {
  const kb = currentKB();
  let subs: Substitution[] = [{}];
  for (const g of goals) {
    const next: Substitution[] = [];
    if (isNeverGoal(g)) {
      // Negation as failure: retain sub iff inner goal is unprovable under it
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

function solveOne(g: Fact, sub: Substitution, kb: readonly Fact[]): Substitution[] {
  const out: Substitution[] = [];
  for (const fact of kb) {
    if (fact.relation !== g.relation) continue;
    if (fact.terms.length !== g.terms.length) continue;
    const merged = unifyTerms(g.terms, fact.terms, sub);
    if (merged) out.push(merged);
  }
  return out;
}

function unifyTerms(a: readonly unknown[], b: readonly unknown[], sub: Substitution): Substitution | null {
  let cur: Substitution = sub;
  for (let i = 0; i < a.length; i++) {
    const next = unifyOne(a[i], b[i], cur);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function unifyOne(a: unknown, b: unknown, sub: Substitution): Substitution | null {
  const aw = walk(a, sub), bw = walk(b, sub);
  if (isLVar(aw) && isLVar(bw) && aw.name === bw.name) return sub;
  if (isLVar(aw)) return { ...sub, [aw.name]: bw };
  if (isLVar(bw)) return { ...sub, [bw.name]: aw };
  return Object.is(aw, bw) ? sub : null;
}

function walk(x: unknown, sub: Substitution): unknown {
  while (isLVar(x) && x.name in sub) x = sub[x.name];
  return x;
}

function isLVar(x: unknown): x is LVar {
  return !!x && typeof x === "object" && (x as LVar).__lvar === true;
}

/** Build a goal (Fact-shaped) without asserting into the KB. */
export function goal(relation: string, ...terms: readonly unknown[]): Fact {
  return { __fact: true, relation, terms };
}

// -----------------------------------------------------------------------------
// T  : Then (BDD) | Tap
// -----------------------------------------------------------------------------

export function T<Fix = unknown>(label: string, check: (fixture: Fix) => void | Promise<void>): ThenNode<Fix>;
export function T<X>(fn: (x: X) => void): (x: X) => X;
export function T(first: any, second?: any): any {
  if (typeof first === "function") return (x: unknown) => { first(x); return x; };
  return { kind: "then", label: first, check: second };
}

// -----------------------------------------------------------------------------
// U  : Unfold | Until — async-aware on Until
// -----------------------------------------------------------------------------

export function U<S, T>(seed: S, step: (s: S) => readonly [T, S] | null): Iterable<T>;
export function U(cond: () => boolean, body: () => void, maxIter?: number): void;
export function U(cond: () => Promise<boolean>, body: () => void | Promise<void>, maxIter?: number): Promise<void>;
export function U(first: any, second: any, third?: number): any {
  if (typeof first === "function") {
    let iters = 0;
    const cap = third ?? 1_000_000;
    const loop = (): any => {
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
  const seed = first; const step = second as AnyFn;
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

export function V<B extends Record<string, unknown>, R>(bindings: B, body: (scope: B) => R): R {
  return body(bindings);
}

// -----------------------------------------------------------------------------
// W  : When (BDD) | While — async-aware
// -----------------------------------------------------------------------------

export function W<Fix = unknown>(label: string, then: ThenNode<Fix>): WhenNode<Fix>;
export function W(cond: () => boolean, body: () => void, maxIter?: number): void;
export function W(cond: () => Promise<boolean>, body: () => void | Promise<void>, maxIter?: number): Promise<void>;
export function W(first: any, second: any, third?: number): any {
  if (typeof first === "function") {
    let iters = 0;
    const cap = third ?? 1_000_000;
    const loop = (): any => {
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

export function X(strings: TemplateStringsArray, ...values: unknown[]): Promise<string>;
export function X(relation: string, ...terms: readonly unknown[]): Substitution[];
export function X(first: any, ...rest: any[]): any {
  if (Array.isArray(first) && "raw" in first) return executeShell(first as TemplateStringsArray, rest, "/bin/bash");
  return solve([{ __fact: true, relation: first, terms: rest }]);
}

async function executeShell(strings: TemplateStringsArray, values: unknown[], shell: string): Promise<string> {
  let cmd = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) cmd += shellEscape(String(values[i])) + (strings[i + 1] ?? "");
  const { promisify } = await import("node:util");
  const { exec } = await import("node:child_process");
  const pExec = promisify(exec);
  const { stdout } = await pExec(cmd, { shell });
  return stdout;
}

function shellEscape(s: string): string { return `'${s.replace(/'/g, `'\\''`)}'`; }

export namespace X {
  export function zsh(strings: TemplateStringsArray, ...values: unknown[]): Promise<string> {
    return executeShell(strings, values, "/bin/zsh");
  }
  export function sh(strings: TemplateStringsArray, ...values: unknown[]): Promise<string> {
    return executeShell(strings, values, "/bin/sh");
  }
}

// -----------------------------------------------------------------------------
// Y  : Bounce / Trampoline — async-aware
// -----------------------------------------------------------------------------

const Y_ORIGINAL: unique symbol = Symbol("ALPHABETICA.y.original");

function unwrapY(fn: any): AnyFn {
  return fn?.[Y_ORIGINAL] ?? fn;
}

export function Y<A extends readonly any[], R>(
  fn: (...args: A) => R | Bounce<A>,
): (...args: A) => R;
export function Y<A extends readonly any[], R>(
  fn: (...args: A) => Promise<R | Bounce<A>>,
): (...args: A) => Promise<R>;
export function Y<A extends readonly any[], R>(
  fn: (...args: A) => R | Bounce<A> | Promise<R | Bounce<A>>,
): (...args: A) => R | Promise<R>;
export function Y(fn: AnyFn): AnyFn {
  const wrapped: any = (...args: any[]): any => {
    let current: { fn: AnyFn; args: readonly any[] } = { fn, args };
    while (true) {
      const result = current.fn(...current.args);
      if (isThenable(result)) {
        return (async () => {
          let r: any = await result;
          while (r && typeof r === "object" && (r as any)[BOUNCE]) {
            const inner = unwrapY((r as Bounce).fn);
            r = await inner(...(r as Bounce).args);
          }
          return r;
        })();
      }
      if (result && typeof result === "object" && (result as any)[BOUNCE]) {
        current = {
          fn: unwrapY((result as Bounce).fn),
          args: (result as Bounce).args,
        };
        continue;
      }
      return result;
    }
  };
  wrapped[Y_ORIGINAL] = fn;
  return wrapped;
}

export namespace Y {
  export function bounce<A extends readonly any[]>(fn: (...args: A) => any, ...args: A): Bounce<A> {
    return { [BOUNCE]: true, fn, args } as Bounce<A>;
  }
}

// -----------------------------------------------------------------------------
// Z  : Zip
// -----------------------------------------------------------------------------

export function Z<A, B>(a: readonly A[], b: readonly B[]): Array<[A, B]>;
export function Z<A, B, C>(a: readonly A[], b: readonly B[], c: readonly C[]): Array<[A, B, C]>;
export function Z<A, B, C, D>(a: readonly A[], b: readonly B[], c: readonly C[], d: readonly D[]): Array<[A, B, C, D]>;
export function Z(...arrs: readonly (readonly unknown[])[]): unknown[][] {
  const len = Math.min(...arrs.map((a) => a.length));
  const out: unknown[][] = [];
  for (let i = 0; i < len; i++) out.push(arrs.map((a) => a[i]));
  return out;
}

// =============================================================================
// Runner
// =============================================================================

export type TestStatus = "passed" | "failed" | "skipped";
export type ScopeGranularity = "given" | "state" | "when" | "then";

export interface TestResult {
  readonly path: readonly string[];
  readonly status: TestStatus;
  readonly error?: Error;
  readonly durationMs: number;
}

export interface TestReport {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly durationMs: number;
  readonly results: readonly TestResult[];
}

export interface RunOpts {
  /** Where to open a fresh KB scope. Default: "then" (per-assertion isolation). */
  readonly kbScope?: ScopeGranularity;
  /** Suppress console output; results still returned. */
  readonly silent?: boolean;
  /** Filter which test paths run. Receives full path, returns true to include. */
  readonly filter?: (path: readonly string[]) => boolean;
}

/** Execute a test tree (or array of trees) and return a structured report. */
export async function run(
  tree: TestNode | readonly TestNode[],
  opts: RunOpts = {},
): Promise<TestReport> {
  const trees = Array.isArray(tree) ? tree : [tree as TestNode];
  const results: TestResult[] = [];
  const kbScope = opts.kbScope ?? "then";
  const log = opts.silent ? () => {} : console.log.bind(console);
  const start = performance.now();

  for (const t of trees) {
    await runNode(t, [], results, { kbScope, filter: opts.filter, log });
  }

  const passed  = results.filter(r => r.status === "passed").length;
  const failed  = results.filter(r => r.status === "failed").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const durationMs = performance.now() - start;

  if (!opts.silent) {
    log(`\n${passed} passed, ${failed} failed, ${skipped} skipped  (${durationMs.toFixed(1)}ms)`);
  }
  return { passed, failed, skipped, durationMs, results };
}

interface RunCtx {
  readonly kbScope: ScopeGranularity;
  readonly filter?: (path: readonly string[]) => boolean;
  readonly log: (...args: unknown[]) => void;
}

async function runNode(
  node: TestNode,
  path: readonly string[],
  results: TestResult[],
  ctx: RunCtx,
): Promise<void> {
  switch (node.kind) {
    case "describe": {
      const p = [...path, node.label];
      ctx.log(`${"  ".repeat(path.length)}${node.label}`);
      for (const child of node.children) await runNode(child, p, results, ctx);
      return;
    }
    case "examine": {
      const p = [...path, node.label];
      if (ctx.filter && !ctx.filter(p)) {
        results.push({ path: p, status: "skipped", durationMs: 0 });
        return;
      }
      await executeCheck(p, () => node.body(), results, ctx);
      return;
    }
    case "given": {
      const p = [...path, `Given ${node.label}`];
      ctx.log(`${"  ".repeat(path.length)}Given ${node.label}`);
      const wrap = ctx.kbScope === "given"
        ? <R>(fn: () => Promise<R>) => withKB([], fn)
        : <R>(fn: () => Promise<R>) => fn();
      await wrap(async () => {
        for (const state of node.states) await runState(state, p, results, ctx);
      });
      return;
    }
  }
}

async function runState(
  state: StateNode,
  path: readonly string[],
  results: TestResult[],
  ctx: RunCtx,
): Promise<void> {
  const p = [...path, state.label];
  ctx.log(`${"  ".repeat(path.length)}${state.label}`);
  const wrap = ctx.kbScope === "state"
    ? <R>(fn: () => Promise<R>) => withKB([], fn)
    : <R>(fn: () => Promise<R>) => fn();
  await wrap(async () => {
    for (const when of state.whens) {
      const wp = [...p, `When ${when.label}`];
      ctx.log(`${"  ".repeat(path.length + 1)}When ${when.label}`);
      const whenWrap = ctx.kbScope === "when"
        ? <R>(fn: () => Promise<R>) => withKB([], fn)
        : <R>(fn: () => Promise<R>) => fn();
      await whenWrap(async () => {
        const tp = [...wp, `Then ${when.then.label}`];
        if (ctx.filter && !ctx.filter(tp)) {
          results.push({ path: tp, status: "skipped", durationMs: 0 });
          return;
        }
        const exec = () => (when.then.check as AnyFn)(state.fixture);
        if (ctx.kbScope === "then") {
          await withKB([], () => executeCheck(tp, exec, results, ctx));
        } else {
          await executeCheck(tp, exec, results, ctx);
        }
      });
    }
  });
}

async function executeCheck(
  path: readonly string[],
  exec: () => void | Promise<void>,
  results: TestResult[],
  ctx: RunCtx,
): Promise<void> {
  const t0 = performance.now();
  const indent = "  ".repeat(path.length);
  try {
    const r = exec();
    if (isThenable(r)) await r;
    const durationMs = performance.now() - t0;
    results.push({ path, status: "passed", durationMs });
    ctx.log(`${indent}\u2713 ${path[path.length - 1]}  (${durationMs.toFixed(1)}ms)`);
  } catch (e) {
    const durationMs = performance.now() - t0;
    const error = e instanceof Error ? e : new Error(String(e));
    results.push({ path, status: "failed", error, durationMs });
    ctx.log(`${indent}\u2717 ${path[path.length - 1]}  (${durationMs.toFixed(1)}ms)`);
    ctx.log(`${indent}  ${error.message}`);
  }
}

// =============================================================================
// Namespace export
// =============================================================================

export const ALPHABETICA = {
  _, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
  run, withKB, scope, currentKB, goal,
  MODULE_NAME, MODULE_DOC, DOC, WILDCARD, BOUNCE,
} as const;

// =============================================================================
// USAGE SKETCHES
// =============================================================================
//
// --- BDD with fixture injection ---
// const suite = G(["Context1",
//   ["State1", {x: 1, y: 2, z: 4},
//     W("Behavior1", T("x equals 1", ({x}: {x: number}) => A(E(x, 1)))),
//     W("Behavior2", T("y equals 2", ({y}: {y: number}) => A(E(y, 2)))),
//   ],
//   ["State2", {x: 10, y: 20, z: 30},
//     W("Behavior3", T("z equals 30", ({z}: {z: number}) => A(E(z, 30)))),
//   ],
// ]);
// await run(suite);
//
// --- BDD with V for scoped bindings (fixture can be empty metadata) ---
// const suite2 = G(["Context1",
//   ["State1", {},
//     ...V({x: 1, y: 2}, ({x, y}) => [
//       W("adds", T("sum is 3", () => A(E(x + y, 3)))),
//     ]),
//   ],
// ]);
//
// --- Pattern match with typed captures ---
// type User  = { kind: "user";  name: string; age: number };
// type Admin = { kind: "admin"; name: string; perms: readonly string[] };
// const classify = (v: User | Admin) => B(v,
//   [{ kind: "user",  name: _("n") }, ({ n }) => `user ${n}`],
//   //                                    ^ n inferred as string
//   [{ kind: "admin", name: _("n") }, ({ n }) => `admin ${n}`],
// );
//
// --- miniKanren with scoped KB ---
// await withKB([], async () => {
//   F("parent", "alice", "bob");
//   F("parent", "bob", "carol");
//   const grandparents = S([
//     goal("parent", "alice", _("x")),
//     goal("parent", _("x"), _("y")),
//   ]); // [{ x: "bob", y: "carol" }]
// });
//
// --- Async fold ---
// const sizes = await F(["a.ts", "b.ts"], 0,
//   async (acc, f) => acc + (await R(f, "utf8")).length);
//
// --- Async trampoline ---
// const countFiles = Y(async (dir: string, acc = 0): Promise<number | Bounce<[string, number]>> => {
//   const contents = (await X`ls ${dir}`).trim().split("\n");
//   return Y.bounce(countFiles, dir, acc + contents.length);
// });

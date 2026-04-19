type AnyFn = (...args: any[]) => any;
export declare const MODULE_NAME: unique symbol;
export declare const MODULE_DOC: unique symbol;
export declare const DOC: unique symbol;
export declare const WILDCARD: unique symbol;
export declare const BOUNCE: unique symbol;
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
export type Pattern<T = unknown> = T | LVar | typeof _ | ((value: T) => boolean) | {
    readonly [K in keyof T]?: Pattern<T[K]>;
};
/** Extract capture bindings from a pattern matched against a scrutinee type. */
export type ExtractCaptures<P, S> = P extends LVar<infer N> ? Record<N, S> : P extends readonly any[] ? {} : P extends object ? S extends object ? UnionToIntersection<{
    [K in keyof P]: K extends keyof S ? ExtractCaptures<P[K], S[K]> : {};
}[keyof P]> extends infer I ? {
    [K in keyof I]: I[K];
} : never : {} : {};
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
/** Trampoline continuation. */
export interface Bounce<A extends readonly any[] = readonly any[]> {
    readonly [BOUNCE]: true;
    readonly fn: (...args: A) => any;
    readonly args: A;
}
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
export type StateTuple<Fix = any> = readonly [label: string, fixture: Fix, ...whens: WhenNode<Fix>[]];
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
export type Module<N extends string, Members extends Record<string, unknown>> = Readonly<Members> & {
    readonly [MODULE_NAME]: N;
    readonly [MODULE_DOC]?: string;
};
export type KnowledgeBase = Fact[];
/** Returns the KB active in the current async scope, or the root KB. */
export declare function currentKB(): KnowledgeBase;
/** Run `fn` with a fresh or supplied KB scope. Async-safe across awaits. */
export declare function withKB<R>(fn: () => R): R;
export declare function withKB<R>(kb: KnowledgeBase, fn: () => R): R;
/** TS 5.2+ disposable scope. Usage: `using s = scope();`. */
export declare function scope(kb?: KnowledgeBase): Disposable & {
    kb: KnowledgeBase;
};
export declare const _: {
    <N extends string>(name: N): LVar<N>;
    (): never;
    readonly [WILDCARD]: true;
};
export declare function A(condition: boolean, message?: string): asserts condition;
export declare function A<R>(thunk: () => R, message?: string): R;
export declare function A<Args extends readonly any[], R>(fn: (...args: Args) => R, ...args: Args): R;
type Arm<P, S, R> = readonly [P, (captures: ExtractCaptures<P, S>) => R];
export declare function B<S, P1, R1>(scrutinee: S, a1: Arm<P1, S, R1>): R1;
export declare function B<S, P1, R1, P2, R2>(scrutinee: S, a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>): R1 | R2;
export declare function B<S, P1, R1, P2, R2, P3, R3>(scrutinee: S, a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>): R1 | R2 | R3;
export declare function B<S, P1, R1, P2, R2, P3, R3, P4, R4>(scrutinee: S, a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>): R1 | R2 | R3 | R4;
export declare function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5>(scrutinee: S, a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>): R1 | R2 | R3 | R4 | R5;
export declare function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5, P6, R6>(scrutinee: S, a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>, a6: Arm<P6, S, R6>): R1 | R2 | R3 | R4 | R5 | R6;
export declare function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5, P6, R6, P7, R7>(scrutinee: S, a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>, a6: Arm<P6, S, R6>, a7: Arm<P7, S, R7>): R1 | R2 | R3 | R4 | R5 | R6 | R7;
export declare function B<S, P1, R1, P2, R2, P3, R3, P4, R4, P5, R5, P6, R6, P7, R7, P8, R8>(scrutinee: S, a1: Arm<P1, S, R1>, a2: Arm<P2, S, R2>, a3: Arm<P3, S, R3>, a4: Arm<P4, S, R4>, a5: Arm<P5, S, R5>, a6: Arm<P6, S, R6>, a7: Arm<P7, S, R7>, a8: Arm<P8, S, R8>): R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8;
export declare function B<S, R>(scrutinee: S, ...arms: readonly (readonly [unknown, (captures: Record<string, unknown>) => R])[]): R;
export interface ClassSpec<P extends object = object> {
    readonly constructor?: (this: P, ...args: any[]) => void;
    readonly methods?: Readonly<Record<string, AnyFn>>;
    readonly static?: Readonly<Record<string, unknown>>;
    readonly extends?: new (...args: any[]) => object;
}
export declare function C<N extends string, P extends object = object>(name: N, spec: ClassSpec<P>): new (...args: any[]) => P;
export declare function C<A, B>(f: (a: A) => B): (a: A) => B;
export declare function C<A, B, CC>(f: (b: B) => CC, g: (a: A) => B): (a: A) => CC;
export declare function C<A, B, CC, D>(f: (c: CC) => D, g: (b: B) => CC, h: (a: A) => B): (a: A) => D;
export declare function C<A, B, CC, D, E>(f: (d: D) => E, g: (c: CC) => D, h: (b: B) => CC, i: (a: A) => B): (a: A) => E;
export declare function D<R>(fn: () => R): R;
export declare function D(label: string, body: () => void): DescribeNode;
export declare function D<T>(doc: string, value: T): T & {
    readonly [DOC]: string;
};
export declare function E<T>(a: T, b: T): boolean;
export declare function E<T>(a: T): (b: T) => boolean;
export declare function E(label: string, body: () => void | Promise<void>): ExamineNode;
export declare function F<T, U>(arr: readonly T[], init: U, fn: (acc: U, x: T) => U): U;
export declare function F<T, U>(arr: readonly T[], init: U, fn: (acc: U, x: T) => Promise<U>): Promise<U>;
export declare function F<T, U>(arr: readonly T[], init: U, fn: (acc: U, x: T) => U | Promise<U>): U | Promise<U>;
export declare function F<T, U>(fn: (x: T, acc: U) => U, init: U, arr: readonly T[]): U;
export declare function F<T, U>(fn: (x: T, acc: U) => Promise<U>, init: U, arr: readonly T[]): Promise<U>;
export declare function F<T, U>(fn: (x: T, acc: U) => U | Promise<U>, init: U, arr: readonly T[]): U | Promise<U>;
export declare function F(relation: string, ...terms: readonly unknown[]): Fact;
export declare function G(tree: readonly [label: string, ...states: StateTuple[]]): GivenNode;
export declare function G<T>(obj: T, path: string): unknown;
export declare function H(): Map<unknown, unknown>;
export declare function H<K, V>(entries: Iterable<readonly [K, V]>): Map<K, V>;
export declare function H<V>(obj: Record<string, V>): Map<string, V>;
export declare function H<T extends object>(obj: T, key: PropertyKey): boolean;
export declare function I<T>(x: T): T;
export declare function I<T, U>(cond: unknown, thn: T, els: U): T | U;
export declare function L<R>(name: string, body: () => R): R;
export declare function J(name: string, value?: unknown): never;
export declare function K<T>(x: T): () => T;
export declare function M<N extends string, Members extends Record<string, unknown>>(name: N, members: Members, doc?: string): Module<N, Members>;
/** An anti-fact: in a goal list, succeeds iff the inner goal is unprovable. */
export interface NeverGoal {
    readonly __never: true;
    readonly goal: Fact;
}
export declare function N(goal: Fact): NeverGoal;
export declare function N(x: boolean): boolean;
export declare function N<A extends readonly any[]>(pred: (...args: A) => boolean): (...args: A) => boolean;
export declare function O<T>(arr: readonly T[]): T[];
export declare function O<T>(arr: readonly T[], cmp: (a: T, b: T) => number): T[];
export declare function O<T, K extends string | number | bigint>(arr: readonly T[], key: (t: T) => K): T[];
export declare function P<A, B>(f: (a: A) => B): (a: A) => B;
export declare function P<A, B, CC>(f: (a: A) => B, g: (b: B) => CC): (a: A) => CC;
export declare function P<A, B, CC, D>(f: (a: A) => B, g: (b: B) => CC, h: (c: CC) => D): (a: A) => D;
export declare function P<A, B, CC, D, E>(f: (a: A) => B, g: (b: B) => CC, h: (c: CC) => D, i: (d: D) => E): (a: A) => E;
export declare function Q(x: string): number;
export declare function Q<T>(x: readonly T[]): number;
export declare function Q<K, V>(x: Map<K, V>): number;
export declare function Q<T>(x: Set<T>): number;
export declare function Q(x: object): number;
type RWOpts = {
    readonly write: string | Uint8Array;
} | {
    readonly append: string | Uint8Array;
};
export declare function R(condition: boolean, message?: string): asserts condition is false;
export declare function R<T = unknown>(spec: string): Promise<T>;
export declare function R(path: string, encoding: BufferEncoding): Promise<string>;
export declare function R(path: string, opts: RWOpts): Promise<void>;
export declare function S(goals: readonly (Fact | NeverGoal)[]): Substitution[];
export declare function S<T>(items?: Iterable<T>): Set<T>;
/** Build a goal (Fact-shaped) without asserting into the KB. */
export declare function goal(relation: string, ...terms: readonly unknown[]): Fact;
export declare function T<Fix = unknown>(label: string, check: (fixture: Fix) => void | Promise<void>): ThenNode<Fix>;
export declare function T<X>(fn: (x: X) => void): (x: X) => X;
export declare function U<S, T>(seed: S, step: (s: S) => readonly [T, S] | null): Iterable<T>;
export declare function U(cond: () => boolean, body: () => void, maxIter?: number): void;
export declare function U(cond: () => Promise<boolean>, body: () => void | Promise<void>, maxIter?: number): Promise<void>;
export declare function V<B extends Record<string, unknown>, R>(bindings: B, body: (scope: B) => R): R;
export declare function W<Fix = unknown>(label: string, then: ThenNode<Fix>): WhenNode<Fix>;
export declare function W(cond: () => boolean, body: () => void, maxIter?: number): void;
export declare function W(cond: () => Promise<boolean>, body: () => void | Promise<void>, maxIter?: number): Promise<void>;
export declare function X(strings: TemplateStringsArray, ...values: unknown[]): Promise<string>;
export declare function X(relation: string, ...terms: readonly unknown[]): Substitution[];
export declare namespace X {
    function zsh(strings: TemplateStringsArray, ...values: unknown[]): Promise<string>;
    function sh(strings: TemplateStringsArray, ...values: unknown[]): Promise<string>;
}
export declare function Y<A extends readonly any[], R>(fn: (...args: A) => R | Bounce<A>): (...args: A) => R;
export declare function Y<A extends readonly any[], R>(fn: (...args: A) => Promise<R | Bounce<A>>): (...args: A) => Promise<R>;
export declare function Y<A extends readonly any[], R>(fn: (...args: A) => R | Bounce<A> | Promise<R | Bounce<A>>): (...args: A) => R | Promise<R>;
export declare namespace Y {
    function bounce<A extends readonly any[]>(fn: (...args: A) => any, ...args: A): Bounce<A>;
}
export declare function Z<A, B>(a: readonly A[], b: readonly B[]): Array<[A, B]>;
export declare function Z<A, B, C>(a: readonly A[], b: readonly B[], c: readonly C[]): Array<[A, B, C]>;
export declare function Z<A, B, C, D>(a: readonly A[], b: readonly B[], c: readonly C[], d: readonly D[]): Array<[A, B, C, D]>;
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
export declare function run(tree: TestNode | readonly TestNode[], opts?: RunOpts): Promise<TestReport>;
export declare const ALPHABETICA: {
    readonly _: {
        <N extends string>(name: N): LVar<N>;
        (): never;
        readonly [WILDCARD]: true;
    };
    readonly A: typeof A;
    readonly B: typeof B;
    readonly C: typeof C;
    readonly D: typeof D;
    readonly E: typeof E;
    readonly F: typeof F;
    readonly G: typeof G;
    readonly H: typeof H;
    readonly I: typeof I;
    readonly J: typeof J;
    readonly K: typeof K;
    readonly L: typeof L;
    readonly M: typeof M;
    readonly N: typeof N;
    readonly O: typeof O;
    readonly P: typeof P;
    readonly Q: typeof Q;
    readonly R: typeof R;
    readonly S: typeof S;
    readonly T: typeof T;
    readonly U: typeof U;
    readonly V: typeof V;
    readonly W: typeof W;
    readonly X: typeof X;
    readonly Y: typeof Y;
    readonly Z: typeof Z;
    readonly run: typeof run;
    readonly withKB: typeof withKB;
    readonly scope: typeof scope;
    readonly currentKB: typeof currentKB;
    readonly goal: typeof goal;
    readonly MODULE_NAME: typeof MODULE_NAME;
    readonly MODULE_DOC: typeof MODULE_DOC;
    readonly DOC: typeof DOC;
    readonly WILDCARD: typeof WILDCARD;
    readonly BOUNCE: typeof BOUNCE;
};
export {};
//# sourceMappingURL=alphabetica.d.ts.map
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
export type Pattern<T = unknown> =
  | T
  | LVar
  | typeof _
  | ((value: T) => boolean)
  | {
      readonly [K in keyof T]?: Pattern<T[K]>;
    };
/** Rest-capture marker used inside array patterns: _.rest("name"). */
export interface RestLVar<N extends string = string> {
  readonly __rest_lvar: true;
  readonly name: N;
}
/** Extract capture bindings from a pattern matched against a scrutinee type. */
export type ExtractCaptures<P, S> = ExtractCapturesImpl<P, Narrow<P, S>>;
type ExtractCapturesImpl<P, S> =
  P extends LVar<infer N>
    ? Record<N, S>
    : P extends RestLVar<infer N>
      ? Record<N, S extends readonly (infer El)[] ? El[] : unknown[]>
      : P extends readonly unknown[]
        ? ExtractArrayCaptures<P, S>
        : P extends object
          ? [S] extends [object]
            ? UnionToIntersection<
                {
                  [K in keyof P]: K extends keyof S
                    ? ExtractCapturesImpl<P[K], S[K]>
                    : {};
                }[keyof P]
              > extends infer I
              ? {
                  [K in keyof I]: I[K];
                }
              : never
            : {}
          : {};
type ExtractArrayCaptures<
  P extends readonly unknown[],
  S,
> = P extends readonly [infer PHead, ...infer PRest]
  ? PHead extends RestLVar<infer N>
    ? Merge<
        Record<N, S extends readonly (infer El)[] ? El[] : unknown[]>,
        ExtractArrayCaptures<PRest, S>
      >
    : S extends readonly [infer SHead, ...infer SRest]
      ? Merge<
          ExtractCapturesImpl<PHead, SHead>,
          ExtractArrayCaptures<PRest, SRest>
        >
      : S extends readonly (infer El)[]
        ? Merge<
            ExtractCapturesImpl<PHead, El>,
            ExtractArrayCaptures<PRest, readonly El[]>
          >
        : {}
  : {};
type Merge<A, B> = A & B extends infer I
  ? {
      [K in keyof I]: I[K];
    }
  : never;
/** Narrow the scrutinee type `S` by the pattern `P`. Drives handler value type.
 *
 * Distributes over union members of S so `Narrow<{kind: "ok"}, Ok | Err>` gives
 * `Ok` (not `Ok | Err`). For each variant, we check structural compatibility
 * with P; incompatible variants are excluded. If no variant matches, returns
 * `never` (signaling to the caller that the pattern is unreachable).
 */
export type Narrow<P, S> = P extends LVar
  ? S
  : P extends RestLVar
    ? S
    : P extends {
          readonly [WILDCARD]: true;
        }
      ? S
      : P extends (v: any) => v is infer U
        ? Extract<S, U>
        : P extends (...args: any) => any
          ? S
          : P extends readonly unknown[]
            ? NarrowArray<P, S>
            : [P] extends [object]
              ? DistributeNarrow<P, S> extends infer R
                ? [R] extends [never]
                  ? S
                  : R
                : S
              : P extends S
                ? P
                : S;
/** Distributes over each variant of S; keeps ones structurally compatible with P. */
type DistributeNarrow<P, S> = S extends any
  ? Compatible<P, S> extends true
    ? NarrowOne<P, S>
    : never
  : never;
/** Is pattern P compatible with scrutinee-variant S? Checks only keys that P specifies. */
type Compatible<P, S> = [P] extends [object]
  ? [S] extends [object]
    ? {
        [K in keyof P & keyof S]: P[K] extends LVar
          ? true
          : P[K] extends RestLVar
            ? true
            : P[K] extends {
                  readonly [WILDCARD]: true;
                }
              ? true
              : P[K] extends (...args: any) => any
                ? true
                : IsCompatibleValue<P[K], S[K]>;
      }[keyof P & keyof S] extends true
      ? HasAllRequired<P, S>
      : false
    : false
  : true;
/** Does S have keys for every key P expects (non-capture, non-wildcard)? */
type HasAllRequired<P, S> = keyof P extends keyof S ? true : false;
/** Is a single pattern value compatible with a single scrutinee value? */
type IsCompatibleValue<PV, SV> = [PV] extends [SV]
  ? true
  : [SV] extends [PV]
    ? true
    : [PV] extends [object]
      ? [SV] extends [object]
        ? Compatible<PV, SV>
        : false
      : false;
/** For one matching variant, recursively narrow the inside too. */
type NarrowOne<P, S> = [P] extends [object]
  ? [S] extends [object]
    ? S extends readonly unknown[]
      ? S
      : {
          [K in keyof S]: K extends keyof P ? Narrow<P[K], S[K]> : S[K];
        }
    : S
  : S;
type NarrowArray<P extends readonly unknown[], S> =
  DistributeNarrowArray<P, S> extends infer R
    ? [R] extends [never]
      ? S
      : R
    : S;
type DistributeNarrowArray<
  P extends readonly unknown[],
  S,
> = S extends readonly unknown[]
  ? ArrayCompatible<P, S> extends true
    ? S
    : never
  : never;
type ArrayCompatible<
  P extends readonly unknown[],
  S extends readonly unknown[],
> =
  HasRest<P> extends true
    ? ArrayCompatibleRest<P, S>
    : S["length"] extends P["length"]
      ? ElementsCompatible<P, S>
      : false;
type ElementsCompatible<
  P extends readonly unknown[],
  S extends readonly unknown[],
> = P extends readonly [infer PH, ...infer PT]
  ? S extends readonly [infer SH, ...infer ST]
    ? IsElementCompatible<PH, SH> extends true
      ? PT extends readonly unknown[]
        ? ST extends readonly unknown[]
          ? ElementsCompatible<PT, ST>
          : true
        : true
      : false
    : true
  : true;
type ArrayCompatibleRest<
  P extends readonly unknown[],
  S extends readonly unknown[],
> = P extends readonly [infer PH, ...infer PT]
  ? PH extends RestLVar<string>
    ? true
    : S extends readonly [infer SH, ...infer ST]
      ? IsElementCompatible<PH, SH> extends true
        ? PT extends readonly unknown[]
          ? ST extends readonly unknown[]
            ? ArrayCompatibleRest<PT, ST>
            : true
          : true
        : false
      : false
  : true;
type IsElementCompatible<PV, SV> = PV extends LVar
  ? true
  : PV extends RestLVar
    ? true
    : PV extends {
          readonly [WILDCARD]: true;
        }
      ? true
      : PV extends (...args: any) => any
        ? true
        : [PV] extends [SV]
          ? true
          : [SV] extends [PV]
            ? true
            : [PV] extends [object]
              ? [SV] extends [object]
                ? Compatible<PV, SV>
                : false
              : false;
type HasRest<P extends readonly unknown[]> = P extends readonly [
  infer H,
  ...infer R,
]
  ? H extends RestLVar<string>
    ? true
    : HasRest<R>
  : false;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;
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
export type StateTuple<Fix = any> = readonly [
  label: string,
  fixture: Fix,
  ...whens: WhenNode<Fix>[],
];
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
export type Module<
  N extends string,
  Members extends Record<string, unknown>,
> = Readonly<Members> & {
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
  rest<N extends string>(name: N): RestLVar<N>;
};
export declare function A(
  condition: boolean,
  message?: string,
): asserts condition;
export declare function A<R>(thunk: () => R, message?: string): R;
export declare function A<Args extends readonly any[], R>(
  fn: (...args: Args) => R,
  ...args: Args
): R;
export declare function B<S, const P1, R1>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
): R1;
export declare function B<S, const P1, R1, const P2, R2>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
  a2: readonly [
    P2,
    (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
  ],
): R1 | R2;
export declare function B<S, const P1, R1, const P2, R2, const P3, R3>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
  a2: readonly [
    P2,
    (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
  ],
  a3: readonly [
    P3,
    (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
  ],
): R1 | R2 | R3;
export declare function B<
  S,
  const P1,
  R1,
  const P2,
  R2,
  const P3,
  R3,
  const P4,
  R4,
>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
  a2: readonly [
    P2,
    (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
  ],
  a3: readonly [
    P3,
    (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
  ],
  a4: readonly [
    P4,
    (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
  ],
): R1 | R2 | R3 | R4;
export declare function B<
  S,
  const P1,
  R1,
  const P2,
  R2,
  const P3,
  R3,
  const P4,
  R4,
  const P5,
  R5,
>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
  a2: readonly [
    P2,
    (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
  ],
  a3: readonly [
    P3,
    (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
  ],
  a4: readonly [
    P4,
    (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
  ],
  a5: readonly [
    P5,
    (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
  ],
): R1 | R2 | R3 | R4 | R5;
export declare function B<
  S,
  const P1,
  R1,
  const P2,
  R2,
  const P3,
  R3,
  const P4,
  R4,
  const P5,
  R5,
  const P6,
  R6,
>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
  a2: readonly [
    P2,
    (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
  ],
  a3: readonly [
    P3,
    (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
  ],
  a4: readonly [
    P4,
    (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
  ],
  a5: readonly [
    P5,
    (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
  ],
  a6: readonly [
    P6,
    (captures: ExtractCaptures<P6, S>, value: Narrow<P6, S>) => R6,
  ],
): R1 | R2 | R3 | R4 | R5 | R6;
export declare function B<
  S,
  const P1,
  R1,
  const P2,
  R2,
  const P3,
  R3,
  const P4,
  R4,
  const P5,
  R5,
  const P6,
  R6,
  const P7,
  R7,
>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
  a2: readonly [
    P2,
    (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
  ],
  a3: readonly [
    P3,
    (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
  ],
  a4: readonly [
    P4,
    (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
  ],
  a5: readonly [
    P5,
    (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
  ],
  a6: readonly [
    P6,
    (captures: ExtractCaptures<P6, S>, value: Narrow<P6, S>) => R6,
  ],
  a7: readonly [
    P7,
    (captures: ExtractCaptures<P7, S>, value: Narrow<P7, S>) => R7,
  ],
): R1 | R2 | R3 | R4 | R5 | R6 | R7;
export declare function B<
  S,
  const P1,
  R1,
  const P2,
  R2,
  const P3,
  R3,
  const P4,
  R4,
  const P5,
  R5,
  const P6,
  R6,
  const P7,
  R7,
  const P8,
  R8,
>(
  scrutinee: S,
  a1: readonly [
    P1,
    (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
  ],
  a2: readonly [
    P2,
    (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
  ],
  a3: readonly [
    P3,
    (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
  ],
  a4: readonly [
    P4,
    (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
  ],
  a5: readonly [
    P5,
    (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
  ],
  a6: readonly [
    P6,
    (captures: ExtractCaptures<P6, S>, value: Narrow<P6, S>) => R6,
  ],
  a7: readonly [
    P7,
    (captures: ExtractCaptures<P7, S>, value: Narrow<P7, S>) => R7,
  ],
  a8: readonly [
    P8,
    (captures: ExtractCaptures<P8, S>, value: Narrow<P8, S>) => R8,
  ],
): R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8;
export declare function B<S, R>(
  scrutinee: S,
  ...arms: readonly (readonly [
    unknown,
    (captures: Record<string, unknown>, value: S) => R,
  ])[]
): R;
/** Remaining<S, Arms> — subtract each arm's narrowed slice from S. */
type Remaining<
  S,
  Arms extends readonly (readonly [unknown, any])[],
> = Arms extends readonly [infer H, ...infer Rest]
  ? H extends readonly [infer P, any]
    ? Rest extends readonly (readonly [unknown, any])[]
      ? Remaining<Exclude<S, Narrow<P, S>>, Rest>
      : Exclude<S, Narrow<P, S>>
    : S
  : S;
/** Return-type wrapper: R when exhaustive, a poisoned error type otherwise. */
type ExhaustiveReturn<
  S,
  Arms extends readonly (readonly [unknown, any])[],
  R,
> = [Remaining<S, Arms>] extends [never]
  ? R
  : {
      readonly __NON_EXHAUSTIVE__: "B.exhaustive: some scrutinee cases are not covered";
      readonly uncoveredCases: Remaining<S, Arms>;
    };
export declare namespace B {
  function exhaustive<S, const P1, R1>(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
  ): ExhaustiveReturn<S, readonly [readonly [P1, any]], R1>;
  function exhaustive<S, const P1, R1, const P2, R2>(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
    a2: readonly [
      P2,
      (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
    ],
  ): ExhaustiveReturn<
    S,
    readonly [readonly [P1, any], readonly [P2, any]],
    R1 | R2
  >;
  function exhaustive<S, const P1, R1, const P2, R2, const P3, R3>(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
    a2: readonly [
      P2,
      (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
    ],
    a3: readonly [
      P3,
      (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
    ],
  ): ExhaustiveReturn<
    S,
    readonly [readonly [P1, any], readonly [P2, any], readonly [P3, any]],
    R1 | R2 | R3
  >;
  function exhaustive<
    S,
    const P1,
    R1,
    const P2,
    R2,
    const P3,
    R3,
    const P4,
    R4,
  >(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
    a2: readonly [
      P2,
      (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
    ],
    a3: readonly [
      P3,
      (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
    ],
    a4: readonly [
      P4,
      (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
    ],
  ): ExhaustiveReturn<
    S,
    readonly [
      readonly [P1, any],
      readonly [P2, any],
      readonly [P3, any],
      readonly [P4, any],
    ],
    R1 | R2 | R3 | R4
  >;
  function exhaustive<
    S,
    const P1,
    R1,
    const P2,
    R2,
    const P3,
    R3,
    const P4,
    R4,
    const P5,
    R5,
  >(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
    a2: readonly [
      P2,
      (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
    ],
    a3: readonly [
      P3,
      (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
    ],
    a4: readonly [
      P4,
      (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
    ],
    a5: readonly [
      P5,
      (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
    ],
  ): ExhaustiveReturn<
    S,
    readonly [
      readonly [P1, any],
      readonly [P2, any],
      readonly [P3, any],
      readonly [P4, any],
      readonly [P5, any],
    ],
    R1 | R2 | R3 | R4 | R5
  >;
  function exhaustive<
    S,
    const P1,
    R1,
    const P2,
    R2,
    const P3,
    R3,
    const P4,
    R4,
    const P5,
    R5,
    const P6,
    R6,
  >(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
    a2: readonly [
      P2,
      (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
    ],
    a3: readonly [
      P3,
      (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
    ],
    a4: readonly [
      P4,
      (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
    ],
    a5: readonly [
      P5,
      (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
    ],
    a6: readonly [
      P6,
      (captures: ExtractCaptures<P6, S>, value: Narrow<P6, S>) => R6,
    ],
  ): ExhaustiveReturn<
    S,
    readonly [
      readonly [P1, any],
      readonly [P2, any],
      readonly [P3, any],
      readonly [P4, any],
      readonly [P5, any],
      readonly [P6, any],
    ],
    R1 | R2 | R3 | R4 | R5 | R6
  >;
  function exhaustive<
    S,
    const P1,
    R1,
    const P2,
    R2,
    const P3,
    R3,
    const P4,
    R4,
    const P5,
    R5,
    const P6,
    R6,
    const P7,
    R7,
  >(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
    a2: readonly [
      P2,
      (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
    ],
    a3: readonly [
      P3,
      (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
    ],
    a4: readonly [
      P4,
      (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
    ],
    a5: readonly [
      P5,
      (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
    ],
    a6: readonly [
      P6,
      (captures: ExtractCaptures<P6, S>, value: Narrow<P6, S>) => R6,
    ],
    a7: readonly [
      P7,
      (captures: ExtractCaptures<P7, S>, value: Narrow<P7, S>) => R7,
    ],
  ): ExhaustiveReturn<
    S,
    readonly [
      readonly [P1, any],
      readonly [P2, any],
      readonly [P3, any],
      readonly [P4, any],
      readonly [P5, any],
      readonly [P6, any],
      readonly [P7, any],
    ],
    R1 | R2 | R3 | R4 | R5 | R6 | R7
  >;
  function exhaustive<
    S,
    const P1,
    R1,
    const P2,
    R2,
    const P3,
    R3,
    const P4,
    R4,
    const P5,
    R5,
    const P6,
    R6,
    const P7,
    R7,
    const P8,
    R8,
  >(
    scrutinee: S,
    a1: readonly [
      P1,
      (captures: ExtractCaptures<P1, S>, value: Narrow<P1, S>) => R1,
    ],
    a2: readonly [
      P2,
      (captures: ExtractCaptures<P2, S>, value: Narrow<P2, S>) => R2,
    ],
    a3: readonly [
      P3,
      (captures: ExtractCaptures<P3, S>, value: Narrow<P3, S>) => R3,
    ],
    a4: readonly [
      P4,
      (captures: ExtractCaptures<P4, S>, value: Narrow<P4, S>) => R4,
    ],
    a5: readonly [
      P5,
      (captures: ExtractCaptures<P5, S>, value: Narrow<P5, S>) => R5,
    ],
    a6: readonly [
      P6,
      (captures: ExtractCaptures<P6, S>, value: Narrow<P6, S>) => R6,
    ],
    a7: readonly [
      P7,
      (captures: ExtractCaptures<P7, S>, value: Narrow<P7, S>) => R7,
    ],
    a8: readonly [
      P8,
      (captures: ExtractCaptures<P8, S>, value: Narrow<P8, S>) => R8,
    ],
  ): ExhaustiveReturn<
    S,
    readonly [
      readonly [P1, any],
      readonly [P2, any],
      readonly [P3, any],
      readonly [P4, any],
      readonly [P5, any],
      readonly [P6, any],
      readonly [P7, any],
      readonly [P8, any],
    ],
    R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8
  >;
}
export interface ClassSpec<P extends object = object> {
  readonly constructor?: (this: P, ...args: any[]) => void;
  readonly methods?: Readonly<Record<string, AnyFn>>;
  readonly static?: Readonly<Record<string, unknown>>;
  readonly extends?: new (...args: any[]) => object;
}
export declare function C<N extends string, P extends object = object>(
  name: N,
  spec: ClassSpec<P>,
): new (...args: any[]) => P;
export declare function C<A, B>(f: (a: A) => B): (a: A) => B;
export declare function C<A, B, CC>(
  f: (b: B) => CC,
  g: (a: A) => B,
): (a: A) => CC;
export declare function C<A, B, CC, D>(
  f: (c: CC) => D,
  g: (b: B) => CC,
  h: (a: A) => B,
): (a: A) => D;
export declare function C<A, B, CC, D, E>(
  f: (d: D) => E,
  g: (c: CC) => D,
  h: (b: B) => CC,
  i: (a: A) => B,
): (a: A) => E;
export declare function D<R>(fn: () => R): R;
export declare function D(label: string, body: () => void): DescribeNode;
export declare function D<T>(
  doc: string,
  value: T,
): T & {
  readonly [DOC]: string;
};
export declare function E<T>(a: T, b: T): boolean;
export declare function E<T>(a: T): (b: T) => boolean;
export declare function E(
  label: string,
  body: () => void | Promise<void>,
): ExamineNode;
type Comparable = number | bigint | string;
type WidenLiteral<T> = T extends number
  ? number
  : T extends bigint
    ? bigint
    : T extends string
      ? string
      : T;
export declare namespace E {
  function lt<T extends Comparable>(a: T, b: T): boolean;
  function lt<T extends Comparable>(a: T): (b: WidenLiteral<T>) => boolean;
  function gt<T extends Comparable>(a: T, b: T): boolean;
  function gt<T extends Comparable>(a: T): (b: WidenLiteral<T>) => boolean;
  function le<T extends Comparable>(a: T, b: T): boolean;
  function le<T extends Comparable>(a: T): (b: WidenLiteral<T>) => boolean;
  function ge<T extends Comparable>(a: T, b: T): boolean;
  function ge<T extends Comparable>(a: T): (b: WidenLiteral<T>) => boolean;
}
export declare function F<T, U>(
  arr: readonly T[],
  init: U,
  fn: (acc: U, x: T) => U,
): U;
export declare function F<T, U>(
  arr: readonly T[],
  init: U,
  fn: (acc: U, x: T) => Promise<U>,
): Promise<U>;
export declare function F<T, U>(
  arr: readonly T[],
  init: U,
  fn: (acc: U, x: T) => U | Promise<U>,
): U | Promise<U>;
export declare function F<T, U>(
  fn: (x: T, acc: U) => U,
  init: U,
  arr: readonly T[],
): U;
export declare function F<T, U>(
  fn: (x: T, acc: U) => Promise<U>,
  init: U,
  arr: readonly T[],
): Promise<U>;
export declare function F<T, U>(
  fn: (x: T, acc: U) => U | Promise<U>,
  init: U,
  arr: readonly T[],
): U | Promise<U>;
export declare function F(relation: string, ...terms: readonly unknown[]): Fact;
export declare function G(
  tree: readonly [label: string, ...states: StateTuple[]],
): GivenNode;
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
export declare function M<
  N extends string,
  Members extends Record<string, unknown>,
>(name: N, members: Members, doc?: string): Module<N, Members>;
/** An anti-fact: in a goal list, succeeds iff the inner goal is unprovable. */
export interface NeverGoal {
  readonly __never: true;
  readonly goal: Fact;
}
export declare function N(goal: Fact): NeverGoal;
export declare function N(x: boolean): boolean;
export declare function N<A extends readonly any[]>(
  pred: (...args: A) => boolean,
): (...args: A) => boolean;
export declare function O<T>(arr: readonly T[]): T[];
export declare function O<T>(
  arr: readonly T[],
  cmp: (a: T, b: T) => number,
): T[];
export declare function O<T, K extends string | number | bigint>(
  arr: readonly T[],
  key: (t: T) => K,
): T[];
export declare function P<A, B>(f: (a: A) => B): (a: A) => B;
export declare function P<A, B, CC>(
  f: (a: A) => B,
  g: (b: B) => CC,
): (a: A) => CC;
export declare function P<A, B, CC, D>(
  f: (a: A) => B,
  g: (b: B) => CC,
  h: (c: CC) => D,
): (a: A) => D;
export declare function P<A, B, CC, D, E>(
  f: (a: A) => B,
  g: (b: B) => CC,
  h: (c: CC) => D,
  i: (d: D) => E,
): (a: A) => E;
export declare function Q(x: string): number;
export declare function Q<T>(x: readonly T[]): number;
export declare function Q<K, V>(x: Map<K, V>): number;
export declare function Q<T>(x: Set<T>): number;
export declare function Q(x: object): number;
type RWOpts =
  | {
      readonly write: string | Uint8Array;
    }
  | {
      readonly append: string | Uint8Array;
    };
export declare function R(
  condition: boolean,
  message?: string,
): asserts condition is false;
export declare function R<T = unknown>(spec: string, base?: string): Promise<T>;
export declare function R(
  path: string,
  encoding: BufferEncoding,
): Promise<string>;
export declare function R(path: string, opts: RWOpts): Promise<void>;
export declare function S(goals: readonly (Fact | NeverGoal)[]): Substitution[];
export declare function S<T>(items?: Iterable<T>): Set<T>;
/** Build a goal (Fact-shaped) without asserting into the KB. */
export declare function goal(
  relation: string,
  ...terms: readonly unknown[]
): Fact;
export declare function T<Fix = unknown>(
  label: string,
  check: (fixture: Fix) => void | Promise<void>,
): ThenNode<Fix>;
export declare function T<X>(fn: (x: X) => void): (x: X) => X;
export declare function U<S, T>(
  seed: S,
  step: (s: S) => readonly [T, S] | null,
): Iterable<T>;
export declare function U(
  cond: () => boolean,
  body: () => void,
  maxIter?: number,
): void;
export declare function U(
  cond: () => Promise<boolean>,
  body: () => void | Promise<void>,
  maxIter?: number,
): Promise<void>;
export declare function V<B extends Record<string, unknown>, R>(
  bindings: B,
  body: (scope: B) => R,
): R;
export declare function W<Fix = unknown>(
  label: string,
  then: ThenNode<Fix>,
): WhenNode<Fix>;
export declare function W(
  cond: () => boolean,
  body: () => void,
  maxIter?: number,
): void;
export declare function W(
  cond: () => Promise<boolean>,
  body: () => void | Promise<void>,
  maxIter?: number,
): Promise<void>;
export declare function X(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<string>;
export declare function X(relation: string): Substitution[];
export declare function X(
  relation: string,
  ...terms: readonly unknown[]
): Substitution[];
export declare namespace X {
  function zsh(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<string>;
  function sh(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<string>;
}
export declare function Y<A extends readonly any[], R>(
  fn: (...args: A) => R | Bounce<A>,
): (...args: A) => R;
export declare function Y<A extends readonly any[], R>(
  fn: (...args: A) => Promise<R | Bounce<A>>,
): (...args: A) => Promise<R>;
export declare function Y<A extends readonly any[], R>(
  fn: (...args: A) => R | Bounce<A> | Promise<R | Bounce<A>>,
): (...args: A) => R | Promise<R>;
export declare namespace Y {
  function bounce<A extends readonly any[]>(
    fn: (...args: A) => any,
    ...args: A
  ): Bounce<A>;
}
export declare function Z<A, B>(
  a: readonly A[],
  b: readonly B[],
): Array<[A, B]>;
export declare function Z<A, B, C>(
  a: readonly A[],
  b: readonly B[],
  c: readonly C[],
): Array<[A, B, C]>;
export declare function Z<A, B, C, D>(
  a: readonly A[],
  b: readonly B[],
  c: readonly C[],
  d: readonly D[],
): Array<[A, B, C, D]>;
export type TestStatus = "passed" | "failed" | "skipped";
export type ScopeGranularity = "given" | "state" | "when" | "then" | "inherit";
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
  /**
   * Where to open a fresh KB scope.
   *   - "given"   — fresh KB per Given block
   *   - "state"   — fresh KB per state within a Given
   *   - "when"    — fresh KB per When
   *   - "then"    — fresh KB per assertion (default; maximum isolation)
   *   - "inherit" — no new KB; inherits the ambient KB from the caller
   *
   * Use "inherit" when you've asserted facts in an outer `withKB` scope and
   * want the test tree to query them rather than running against a fresh KB.
   */
  readonly kbScope?: ScopeGranularity;
  /** Suppress console output; results still returned. */
  readonly silent?: boolean;
  /** Filter which test paths run. Receives full path, returns true to include. */
  readonly filter?: (path: readonly string[]) => boolean;
  /**
   * How to render output. Pass the name of a built-in ("pretty", "tap",
   * "junit", "null") or a custom Reporter object. Default: "pretty".
   * The "null" reporter emits nothing; useful for programmatic runs.
   */
  readonly reporter?: ReporterName | Reporter;
  /** Sink for reporter output. Default: process.stdout.write (or console.log for null-like sinks). */
  readonly write?: (chunk: string) => void;
}
export type ReporterName = "pretty" | "tap" | "junit" | "null";
/** Reporter hooks. All methods are optional; missing hooks are no-ops. */
export interface Reporter {
  readonly name: string;
  onRunStart?(ctx: ReporterCtx): void;
  onSuiteEnter?(
    node: TestNode,
    path: readonly string[],
    ctx: ReporterCtx,
  ): void;
  onResult?(result: TestResult, ctx: ReporterCtx): void;
  onRunEnd?(report: TestReport, ctx: ReporterCtx): void;
}
export interface ReporterCtx {
  readonly write: (chunk: string) => void;
  readonly startedAt: number;
}
/** Execute a test tree (or array of trees) and return a structured report. */
export declare function run(
  tree: TestNode | readonly TestNode[],
  opts?: RunOpts,
): Promise<TestReport>;
export declare const nullReporter: Reporter;
/** Pretty reporter — mirrors the pre-0.4 default output. */
export declare const prettyReporter: Reporter;
/** TAP reporter — TAP version 14 producer. CI-friendly. */
export declare const tapReporter: Reporter;
/** JUnit XML reporter — compatible with Jenkins, GitLab, GitHub Actions. */
export declare const junitReporter: Reporter;
export declare const ALPHABETICA: {
  readonly _: {
    <N extends string>(name: N): LVar<N>;
    (): never;
    rest<N extends string>(name: N): RestLVar<N>;
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
  readonly prettyReporter: Reporter;
  readonly tapReporter: Reporter;
  readonly junitReporter: Reporter;
  readonly nullReporter: Reporter;
  readonly MODULE_NAME: typeof MODULE_NAME;
  readonly MODULE_DOC: typeof MODULE_DOC;
  readonly DOC: typeof DOC;
  readonly WILDCARD: typeof WILDCARD;
  readonly BOUNCE: typeof BOUNCE;
};
export {};
//# sourceMappingURL=alphabetica.d.ts.map

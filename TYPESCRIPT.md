# TypeScript

## T1. Write no `any`; take a value declared `any`, or whose type you do not know, as `unknown` and narrow it.

## T2. Write no `as` cast that a type guard could replace.

## T3. Represent a closed set as a discriminated union, and end every `switch` over it with a `default` that assigns the value to `never`.

## T4. Import Node's built-in modules with the `node:` prefix.

## T5. Run a program as `.ts` on Node 24 or newer; add no step that emits JavaScript.

## T6. Write tests with `node:test` and `node:assert/strict`; add no test framework.

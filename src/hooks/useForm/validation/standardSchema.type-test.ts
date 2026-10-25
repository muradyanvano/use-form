/**
 * Compile-time checks that schemas typed with the published Standard Schema v1 interface
 * (as Zod 4, Valibot, and ArkType declare them) are accepted by `standardSchemaResolver`.
 * Checked by `tsc` / `npm run typecheck`; not executed by Vitest.
 * `scripts/test-package.mjs` repeats this check with `exactOptionalPropertyTypes`.
 */
import { standardSchemaResolver, type StandardSchemaV1 } from './standardSchemaResolver.ts'

/** Verbatim shapes of the spec's `StandardSchemaV1` namespace members (https://standardschema.dev/). */
interface SpecProps<Input = unknown, Output = Input> {
  readonly version: 1
  readonly vendor: string
  readonly validate: (value: unknown) => SpecResult<Output> | Promise<SpecResult<Output>>
  readonly types?: SpecTypes<Input, Output> | undefined
}
type SpecResult<Output> = SpecSuccessResult<Output> | SpecFailureResult
interface SpecSuccessResult<Output> {
  readonly value: Output
  readonly issues?: undefined
}
interface SpecFailureResult {
  readonly issues: ReadonlyArray<SpecIssue>
}
interface SpecIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | SpecPathSegment> | undefined
}
interface SpecPathSegment {
  readonly key: PropertyKey
}
interface SpecTypes<Input = unknown, Output = Input> {
  readonly input: Input
  readonly output: Output
}

type Values = { email: string; items: Array<{ name: string }> }

declare const specSchema: { readonly '~standard': SpecProps<Values> }

export const resolver = standardSchemaResolver(specSchema)
export const assignable: StandardSchemaV1<Values> = specSchema

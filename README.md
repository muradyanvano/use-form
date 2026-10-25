# @muradyanvano/use-form

[![npm version](https://img.shields.io/npm/v/@muradyanvano/use-form)](https://www.npmjs.com/package/@muradyanvano/use-form)
[![npm downloads](https://img.shields.io/npm/dm/@muradyanvano/use-form)](https://www.npmjs.com/package/@muradyanvano/use-form)
[![CI](https://github.com/muradyanvano/use-form/actions/workflows/ci.yml/badge.svg)](https://github.com/muradyanvano/use-form/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@muradyanvano/use-form)](https://github.com/muradyanvano/use-form/blob/main/LICENSE)
[![Storybook](https://img.shields.io/badge/Storybook-docs-FF4785?logo=storybook&logoColor=white)](https://muradyanvano.github.io/use-form/)

Typed React 19 form hooks for nested objects, one-level field arrays, file metadata, validation timing, and accessible native field registration.

Published on npm as **`@muradyanvano/use-form`**. The API is currently pre-1.0; see [CHANGELOG.md](CHANGELOG.md) for released versions.

| Resource      | URL                                                                             |
| ------------- | ------------------------------------------------------------------------------- |
| **Storybook** | [muradyanvano.github.io/use-form](https://muradyanvano.github.io/use-form/)     |
| **npm**       | [@muradyanvano/use-form](https://www.npmjs.com/package/@muradyanvano/use-form)  |
| **GitHub**    | [muradyanvano/use-form](https://github.com/muradyanvano/use-form)               |
| **Issues**    | [GitHub Issues](https://github.com/muradyanvano/use-form/issues)                |
| **Changelog** | [CHANGELOG.md](https://github.com/muradyanvano/use-form/blob/main/CHANGELOG.md) |

Explore interactive examples, validation behavior, field arrays, controlled components, asynchronous flows and DevTools in the [Storybook documentation](https://muradyanvano.github.io/use-form/).

## Features

- Strongly typed values, nested paths (`address.city`), and one-level field arrays (`items.0.name`)
- Native `register()` and headless `useController` for custom controls
- Built-in rules, custom rules, form-level `validate`, Standard Schema resolvers, async debounce, i18n catalogs
- Structured errors (`FieldError` + string view), accessible ids, focus-on-error
- File fields store `File` references only (no content reads)
- Non-reactive getters and atomic `form.batch()`
- Development DevTools on a separate entry (not shipped in core bundles)

## Installation

Stable:

```bash
npm install @muradyanvano/use-form
```

Prerelease (beta channel):

```bash
npm install @muradyanvano/use-form@beta
```

Peers:

- **`react`**: `^19.0.0` (required)
- **`react-dom`**: optional for core-only apps; **required** when importing `@muradyanvano/use-form/devtools`

Contributors can also develop from this repository (`npm ci`) or install a locally packed tarball (see [docs/releasing.md](docs/releasing.md)).

Supported tooling: Node `^20.19.0 || >=22.12.0`, npm `>=10.8.0`.

## Minimal example

```tsx
'use client'

import { rules, useForm, ValidationMode } from '@muradyanvano/use-form'

type LoginValues = { email: string; password: string }

export function LoginForm() {
  const form = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
    mode: ValidationMode.OnSubmit,
    rules: {
      email: [rules.required(), rules.email()],
      password: [rules.required(), rules.minLength(8)],
    },
    onSubmit: (values) => {
      void values
    },
  })

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      <label htmlFor={form.getFieldId('email')}>Email</label>
      <input {...form.register('email')} type="email" />
      {form.errors.email ? <p id={form.getErrorId('email')}>{form.errors.email}</p> : null}

      <label htmlFor={form.getFieldId('password')}>Password</label>
      <input {...form.register('password')} type="password" />
      {form.errors.password ? <p id={form.getErrorId('password')}>{form.errors.password}</p> : null}

      <button type="submit" disabled={form.isSubmitting}>
        Sign in
      </button>
    </form>
  )
}
```

`register()` supplies `name`, `id`, `value`/`checked`, `onChange`, `onBlur`, `ref`, `aria-invalid`, and `aria-describedby` (pointing at `getErrorId(name)` while the field has an error).

Form hooks are **client components**. In React Server Component apps, import them from a file marked `'use client'`.

## Validation example

```tsx
import { rules, useForm, ValidationMode } from '@muradyanvano/use-form'

export function AgeForm() {
  const form = useForm({
    defaultValues: { nickname: '', age: 0 },
    mode: ValidationMode.OnBlur,
    rules: {
      nickname: [rules.required(), rules.minLength(3)],
      age: [rules.required(), rules.min(18)],
    },
  })

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      <label htmlFor={form.getFieldId('nickname')}>Nickname</label>
      <input {...form.register('nickname')} />
      {form.errors.nickname ? <p id={form.getErrorId('nickname')}>{form.errors.nickname}</p> : null}

      <label htmlFor={form.getFieldId('age')}>Age</label>
      <input {...form.register('age', { valueAsNumber: true })} type="number" />
      {form.errors.age ? <p id={form.getErrorId('age')}>{form.errors.age}</p> : null}

      <button type="submit">Save</button>
    </form>
  )
}
```

Rules are typed against the field value: `rules.min` only accepts number fields and `rules.minLength` only string fields. See [docs/validation.md](docs/validation.md) and [docs/async-validation.md](docs/async-validation.md).

## Submission and server errors

`handleSubmit` validates first and calls `onSubmit` only when the form is valid. Map backend failures with the submit helpers; `handleSubmit` rejects if `onSubmit` throws, so catch expected API failures yourself:

```tsx
import { useForm } from '@muradyanvano/use-form'

declare function saveProfile(values: {
  email: string
}): Promise<{ fieldErrors?: { email?: string } }>

export function ProfileForm() {
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async (values, helpers) => {
      try {
        const result = await saveProfile(values)
        if (result.fieldErrors) {
          helpers.setErrors(result.fieldErrors, { source: 'server' })
          return
        }
        helpers.reset(values)
      } catch {
        helpers.setSubmitError('Could not save. Try again.')
      }
    },
  })

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      <input {...form.register('email')} type="email" aria-label="Email" />
      {form.submitError ? <p role="alert">{form.submitError}</p> : null}
      <button type="submit" disabled={form.isSubmitting}>
        Save
      </button>
    </form>
  )
}
```

`helpers.reset()` inside `onSubmit` leaves a fresh, unsubmitted form (`isSubmitted: false`, `submitCount: 0`) unless you pass `keepIsSubmitted` / `keepSubmitCount`.

## TypeScript example

```tsx
import { useForm, type FieldPath } from '@muradyanvano/use-form'

type Profile = {
  email: string
  address: { city: string }
}

export function useProfileForm() {
  const form = useForm<Profile>({
    defaultValues: { email: '', address: { city: '' } },
  })

  const path: FieldPath<Profile> = 'address.city'
  form.setValue(path, 'Yerevan')
  // @ts-expect-error -- unknown paths fail at compile time
  form.setValue('address.zip', '0010')
  return form
}
```

Path inference stops at depth 5. Invalid paths fail at compile time.

## Controlled-component example

```tsx
import { useController, useForm, type FormControl } from '@muradyanvano/use-form'

type Review = { rating: number }

function RatingField({ control }: { control: FormControl<Review> }) {
  const { field, fieldState } = useController({ control, name: 'rating' })

  return (
    <>
      <label htmlFor={field.id}>Rating</label>
      <input
        id={field.id}
        type="range"
        min={0}
        max={5}
        value={field.value}
        onChange={(event) => {
          field.onChange(Number(event.target.value))
        }}
        onBlur={field.onBlur}
        ref={field.ref}
        aria-invalid={field['aria-invalid']}
        aria-describedby={field['aria-describedby']}
      />
      {fieldState.error ? <p id={field.errorId}>{fieldState.error}</p> : null}
    </>
  )
}

export function ReviewForm() {
  const form = useForm<Review>({ defaultValues: { rating: 0 } })
  return <RatingField control={form.control} />
}
```

See [docs/controlled-components.md](docs/controlled-components.md).

## Field-array example

```tsx
import { useFieldArray, useForm } from '@muradyanvano/use-form'

type OrderValues = { items: Array<{ name: string }> }

export function OrderForm() {
  const form = useForm<OrderValues>({ defaultValues: { items: [] } })
  const items = useFieldArray({ control: form.control, name: 'items' })

  return (
    <>
      {items.fields.map((item, index) => (
        <div key={item.key}>
          <input {...form.register(`items.${index}.name`)} aria-label={`Item ${index + 1}`} />
          <button type="button" onClick={() => items.remove(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => items.append({ name: '' })}>
        Add item
      </button>
    </>
  )
}
```

Use `field.key` (not the index) as the React key. One index level only. See [docs/field-arrays.md](docs/field-arrays.md).

## Async validation and defaults

- Debounced remote checks: [docs/async-validation.md](docs/async-validation.md)
- Async `loadDefaultValues`: [docs/async-default-values.md](docs/async-default-values.md)

## Standard Schema resolver

```tsx
import { useForm } from '@muradyanvano/use-form'
import {
  standardSchemaResolver,
  type StandardSchemaV1,
} from '@muradyanvano/use-form/resolvers/standard-schema'

type SignupValues = { email: string }

// Any Standard Schema v1 implementation (Zod 4, Valibot, ArkType, …) works here.
declare const signupSchema: StandardSchemaV1<SignupValues>

export function useSignupForm() {
  return useForm({
    defaultValues: { email: '' },
    resolver: standardSchemaResolver(signupSchema),
  })
}
```

The adapter has **no React import** and may run on the server. It is **not** exported from the core entry. See [docs/schema-resolvers.md](docs/schema-resolvers.md).

## DevTools

```tsx
import { FormProvider, useForm } from '@muradyanvano/use-form'
import { FormDevTools } from '@muradyanvano/use-form/devtools'

export function DebuggableForm() {
  const form = useForm({ defaultValues: { email: '' } })

  return (
    <FormProvider control={form.control}>
      <input {...form.register('email')} aria-label="Email" />
      {import.meta.env.DEV ? <FormDevTools control={form.control} /> : null}
    </FormProvider>
  )
}
```

DevTools requires `react-dom` (portals). Do not ship it as production UI. See [docs/devtools.md](docs/devtools.md).

## Public entry points

| Import                                             | Purpose                                                      |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `@muradyanvano/use-form`                           | Core hooks, rules, types (`'use client'`)                    |
| `@muradyanvano/use-form/devtools`                  | `FormDevTools` inspector (`'use client'`, needs `react-dom`) |
| `@muradyanvano/use-form/resolvers/standard-schema` | `standardSchemaResolver` (no React)                          |
| `@muradyanvano/use-form/package.json`              | Package metadata                                             |

Private paths (for example `@muradyanvano/use-form/hooks/...`) are **not** supported.

Full inventory: [docs/public-api.md](docs/public-api.md).

## React peer support

Tested in this repository with **React 19.2**. React 18, React Native, and CommonJS `require()` are **not** supported or tested.

## SSR

Core hooks are client-only. The library uses a stable server snapshot for selector reads during SSR smoke tests, but **hydrated form UX is not a supported product surface yet**. Do not render interactive forms on the server.

The Standard Schema resolver entry may be imported on the server because it does not import React.

## Browser support

Modern evergreen browsers with native ESM. The library targets client-side React DOM applications tested via Vitest, Testing Library, and Storybook browser runs in CI.

## Known limitations

- ESM only (no CommonJS build)
- Path expansion depth 5; one-level field arrays; no nested arrays inside items
- No first-party Zod/Yup/Valibot adapters (Standard Schema only)
- Client-side validation is UX only — repeat checks on the server

See [docs/package-roadmap.md](docs/package-roadmap.md) and Storybook **Limitations and roadmap**.

## Documentation

- Interactive docs: [Storybook](https://muradyanvano.github.io/use-form/)
- Guides: [docs/](docs/)
- Local Storybook for contributors: `npm run storybook` — rules in [docs/storybook.md](docs/storybook.md)
- API reference (TypeDoc): `npm run docs:api` → gitignored `api-docs/`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the post-change guide [docs/development-workflow.md](docs/development-workflow.md). Run `npm run verify` locally; CI runs `npm run verify:ci` on push/PR.

## Security

See [SECURITY.md](SECURITY.md). Report issues via [GitHub Issues](https://github.com/muradyanvano/use-form/issues) until a dedicated security contact is published.

## License

[MIT](LICENSE) © 2026 Vano Muradyan

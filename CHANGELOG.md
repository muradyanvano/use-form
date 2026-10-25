# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.1.4] - 2026-10-25

### Fixed

- `isValidating` no longer drops to `false` while another field's validation is still running. It is now derived from the set of active, non-superseded validation runs.
- `helpers.reset()` / `form.reset()` called during `handleSubmit` (including inside `onSubmit`) now wins: the stale submit no longer sets `isSubmitted: true` afterward. `reset(values, { keepIsSubmitted: true })` keeps the previous behavior and lets the in-flight submit finish as submitted.
- Prototype hardening: `setValues`, `reset`, async default merges, and value cloning ignore `__proto__`, `prototype`, and `constructor` keys (for example from `JSON.parse` payloads). Previously such a payload could replace the prototype of a nested form-values object so it inherited unexpected properties; global `Object.prototype` was not affected. Path reads (`getValues`, `watch`, errors) now resolve only own properties and numeric array indices, so paths such as `list.length` or `toString` return `undefined`.
- Standard Schema adapter: issue paths containing `__proto__`, `prototype`, or `constructor` are reported as `rootError` instead of a generic message.
- Standard Schema types: `StandardSchemaV1` now matches the spec's optional properties (`path`, `types` allow `undefined`), so Zod 4, Valibot, and ArkType schemas are accepted by `standardSchemaResolver`, including under `exactOptionalPropertyTypes`.
- Declarations no longer import `SubmitEvent` from `react`, which failed to type-check with `@types/react` versions before 19.2.
- `useFieldArray` assigns stable keys during the first render. Items no longer mount twice with placeholder keys.
- `register()` returns a stable ref callback per field, so React no longer detaches and re-attaches inputs on every render. Composed refs that call `ref(null)` still unregister correctly, and an input that stays mounted after `unregister()` registers again on its next render.
- Standard Schema adapter: spec `PathSegment` objects (`{ key }`, used by Valibot) map to field paths instead of `"[object Object]"`.
- `resetField` restores a cloned default so later mutations cannot alias `defaultValues`.
- A deferred `shouldUnregister` task queued before a StrictMode remount no longer fires after the remount.

### Changed

- `handleSubmit` accepts any event with an optional `preventDefault` (for example button click events) or no argument. This is a type widening; existing call sites keep compiling.
- `dirtyFields` is computed once per values/defaults snapshot and shared by `useForm`, `useFormState`, `useFieldState`, `useController`, and getters (fewer full-tree comparisons per keystroke). Because the map is shared, it is now frozen; copy it before mutating.
- Blurring an already-touched field no longer notifies subscribers.
- New exported type `StandardSchemaV1PathSegment` from `@muradyanvano/use-form/resolvers/standard-schema`.

### Deprecated

- `ResetOptions.keepDirty` and `SetValueOptions.shouldDirty` are documented as no-ops (dirty state is derived from values vs defaults). They remain accepted.

### Documentation

- README examples are complete modules and are type-checked against the packed package in `test:package`. Fixed examples that used a non-existent `useController` `defaultValue` option, missing imports, and invalid field paths. Added a submission and server-errors section.
- Documented submission lifecycle, `handleSubmit` rejection, concurrent `isValidating`, and Standard Schema path segments.

### Tooling

- Added `.gitattributes` (LF line endings) so `format:check` passes on Windows checkouts.
- Storybook test runner fails stories that log console or page errors. Fixed a docs page that rendered `<T>` as an HTML element.
- Updated dev tooling to fix security advisories: Storybook 10.6.3 (critical dev-server code injection), Vite 8.3.5, Vitest 4.1.12, plus transitive fixes via `npm audit fix`. The package still has no runtime dependencies.

## [0.1.3] - 2026-09-17

### Package metadata

- Migrated GitHub repository owner from `muradyanvano1995` to `muradyanvano`
- Updated `repository`, `homepage`, and `bugs` URLs in `package.json`
- Updated README, docs, Storybook links, and release guidance to the new GitHub and Pages URLs
- No runtime or public API changes

## [0.1.2] - 2026-08-29

### Package metadata

- Added focused npm discovery keywords.
- Improved the npm package description.
- No runtime or public API changes.

## [0.1.1] - 2026-08-29

### Changed

- Set `package.json` `homepage` to the public Storybook documentation URL
- Added prominent documentation links and status badges in the README
- Documented automatic stable Storybook deployment via GitHub Pages

No runtime or public API changes.

## [0.1.0] - 2026-08-29

First stable-channel release of `@muradyanvano/use-form`.
First stable successor to `0.1.0-beta.2`. The public API remains pre-1.0.

### Consumer-facing capabilities

- Typed form state with nested and indexed paths (depth 5)
- One-level field arrays and controlled components via `useController`
- Form context (`FormProvider`, subscription hooks)
- Built-in and custom validation, async and dependent validation, Standard Schema resolver entry
- Async default values, conditional fields and unregister
- Structured errors with i18n validation messages
- Non-reactive getters and atomic `form.batch()`
- Granular subscriptions (`useWatch`, `useFormState`, `useFieldState`)
- File fields (metadata only, no content reads)
- SSR-safe selector snapshots; resolver entry without React
- DevTools on a separate entry
- Accessible native registration and focus-on-error
- Documented public exports, local Storybook, TypeDoc, and packed-tarball consumer verification

## [0.1.0-beta.2] - 2026-08-28

Published to npm on the `beta` dist-tag.

### Changed

- Trusted Publishing workflow and npm beta channel publish path
- Release documentation and consumer install guidance for published betas

## [0.1.0-beta.1] - 2026-08-27

Published to npm (initial beta; `latest` dist-tag pointed here until a stable release ships).

### Public entry points

- `@muradyanvano/use-form` — core hooks, rules, and types (`'use client'`)
- `@muradyanvano/use-form/devtools` — `FormDevTools` (`'use client'`, requires `react-dom`)
- `@muradyanvano/use-form/resolvers/standard-schema` — `standardSchemaResolver` (no React)
- `@muradyanvano/use-form/package.json` — package metadata

### Added (included in this beta candidate)

- Production-oriented Storybook documentation: light-only theming, landing pages, Getting Started, hierarchy, Controls/Actions, play tests, and local visual smoke
- Docs UI copy button on `CodePanel` (`Copy code`, clipboard API with `execCommand` fallback, keyboard activation, status restore)
- Shared consumer snippets for Storybook Docs (`src/stories/snippets/consumerSnippets.ts`) using `@muradyanvano/use-form` imports
- Documented future proposal for `form.refreshErrorMessages()` (not implemented; built-in type/params only)
- Checkout, radio/checkbox, Standard Schema, and watchers example forms
- `docs/storybook.md` contributor guide and `docs/storybook-audit.md` pre-implementation audit
- `@storybook/addon-docs` (autodocs + Storybook Source / Show code / copy)
- `FormDevTools` CSS variables so the inspector follows documentation tokens

### Changed

- Storybook is light-only (no dark/system toolbar or dark token set)
- Storybook sidebar IA: Core Concepts → Hooks → Fields → Validation → State & Performance → DevTools → Complete Examples (E2E only)
- Example CSS uses documentation tokens instead of hardcoded colors
- Storybook backgrounds addon is disabled; the light theme owns the canvas
- Storybook Docs autodocs is enabled so consumer `source.code` snippets appear on Docs pages
- Localized registration example revalidates visible errors after locale catalogs commit (core `useForm` still does not rewrite resolved strings)
- Consumer-facing docs, Storybook snippets, and README use `@muradyanvano/use-form` instead of `<package-name>`
- `npm pack --json` parsing in package consumer tests (no guessed tarball names)
- Repository, homepage, bugs, and author metadata in `package.json`

### Fixed

- Linux `npm ci` failure (`Missing: @emnapi/core` / `@emnapi/runtime`) by adding those packages as devDependencies for `@napi-rs/wasm-runtime` peer resolution
- Order and resolver demos no longer `console.info` form values (which could include files)
- Internationalization demo left English errors visible after switching language until a manual Revalidate click

### Changed

- `standardSchemaResolver` moved out of the core barrel to `src/resolvers/standard-schema`
- Demo Vite output now writes to `dist-app/`; `dist/` is the library build
- React moved to `peerDependencies` (`^19.0.0`); the demo keeps React in `devDependencies`

### Fixed

- Async `form.batch()` callbacks restore transaction depth and document that pre-await mutations are not rolled back

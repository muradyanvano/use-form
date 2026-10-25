import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useForm } from './useForm.ts'
import { useFieldArray } from './useFieldArray.ts'
import { useController } from './useController.ts'
import { useFieldState, useFormState } from './subscriptions.ts'
import { cloneFormValue, getValueAtPath, mergeDeepPartial } from './pathUtilities.ts'
import type { FormControl } from './formStore.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('isValidating with concurrent field validations', () => {
  it('stays true until every in-flight field validation settles', async () => {
    const slow = deferred<string | undefined>()
    const fast = deferred<string | undefined>()
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { a: '', b: '' },
        mode: 'onChange',
        rules: {
          a: [() => slow.promise],
          b: [() => fast.promise],
        },
      }),
    )

    act(() => {
      result.current.setValue('a', 'x')
      result.current.setValue('b', 'y')
    })
    expect(result.current.isValidating).toBe(true)

    await act(async () => {
      fast.resolve(undefined)
      await fast.promise
    })
    expect(result.current.isValidating).toBe(true)

    await act(async () => {
      slow.resolve('Too slow')
      await slow.promise
    })
    await waitFor(() => {
      expect(result.current.isValidating).toBe(false)
    })
    expect(result.current.errors.a).toBe('Too slow')
  })

  it('reset clears isValidating even when stale validations settle later', async () => {
    const pending = deferred<string | undefined>()
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { a: '' },
        mode: 'onChange',
        rules: { a: [() => pending.promise] },
      }),
    )

    act(() => {
      result.current.setValue('a', 'x')
    })
    expect(result.current.isValidating).toBe(true)

    act(() => {
      result.current.reset()
    })
    expect(result.current.isValidating).toBe(false)

    await act(async () => {
      pending.resolve('stale')
      await pending.promise
    })
    expect(result.current.isValidating).toBe(false)
    expect(result.current.errors.a).toBeUndefined()
  })

  it('a superseded run settling does not end validation of its replacement or another field', async () => {
    const aRuns: Array<ReturnType<typeof deferred<string | undefined>>> = []
    const b = deferred<string | undefined>()
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { a: '', b: '' },
        mode: 'onChange',
        rules: {
          a: [
            () => {
              const run = deferred<string | undefined>()
              aRuns.push(run)
              return run.promise
            },
          ],
          b: [() => b.promise],
        },
      }),
    )

    act(() => {
      result.current.setValue('a', '1')
      result.current.setValue('b', 'x')
      result.current.setValue('a', '2')
    })
    expect(aRuns).toHaveLength(2)

    await act(async () => {
      b.resolve(undefined)
      await b.promise
    })
    expect(result.current.isValidating).toBe(true)

    await act(async () => {
      aRuns[0]!.resolve('stale')
      await aRuns[0]!.promise
    })
    expect(result.current.isValidating).toBe(true)
    expect(result.current.errors.a).toBeUndefined()

    await act(async () => {
      aRuns[1]!.resolve('current')
      await aRuns[1]!.promise
    })
    await waitFor(() => {
      expect(result.current.isValidating).toBe(false)
    })
    expect(result.current.errors.a).toBe('current')
  })

  it('a rejected validator settles its run without ending another in-flight run', async () => {
    const a = deferred<string | undefined>()
    const b = deferred<string | undefined>()
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { a: '', b: '' },
        rules: { a: [() => a.promise], b: [() => b.promise] },
      }),
    )

    let validateA!: Promise<boolean>
    act(() => {
      validateA = result.current.validateField('a')
      void result.current.validateField('b')
    })
    await act(async () => {
      a.reject(new Error('network'))
      await expect(validateA).rejects.toThrow('network')
    })
    expect(result.current.isValidating).toBe(true)

    await act(async () => {
      b.resolve(undefined)
      await b.promise
    })
    await waitFor(() => {
      expect(result.current.isValidating).toBe(false)
    })
  })
})

describe('reset inside onSubmit', () => {
  it('leaves a fresh, unsubmitted form after a successful submit', async () => {
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { name: '' },
        onSubmit: (_values, helpers) => {
          helpers.reset()
        },
      }),
    )

    act(() => {
      result.current.setValue('name', 'Ann')
    })
    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.values.name).toBe('')
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isSubmitted).toBe(false)
    expect(result.current.submitCount).toBe(0)
  })

  it('reset after an awaited submit step also wins', async () => {
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { name: '' },
        onSubmit: async (_values, helpers) => {
          await Promise.resolve()
          helpers.reset({ name: 'next' })
          await Promise.resolve()
        },
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.values.name).toBe('next')
    expect(result.current.isSubmitted).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
  })

  it('a submit without reset is still marked submitted', async () => {
    const { result } = renderHook(() =>
      useForm({ defaultValues: { name: '' }, onSubmit: () => undefined }),
    )
    await act(async () => {
      await result.current.handleSubmit()
    })
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.submitCount).toBe(1)
  })

  it('reset with keepIsSubmitted still lets the submit finish as submitted', async () => {
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { name: '' },
        onSubmit: (_values, helpers) => {
          helpers.reset(undefined, { keepIsSubmitted: true, keepSubmitCount: true })
        },
      }),
    )
    await act(async () => {
      await result.current.handleSubmit()
    })
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitCount).toBe(1)
  })

  it('reset then a rejecting onSubmit leaves a consistent fresh form', async () => {
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { name: '' },
        onSubmit: async (_values, helpers) => {
          helpers.reset()
          await Promise.resolve()
          throw new Error('api down')
        },
      }),
    )
    act(() => {
      result.current.setValue('name', 'Ann')
    })
    await act(async () => {
      await expect(result.current.handleSubmit()).rejects.toThrow('api down')
    })
    expect(result.current.values.name).toBe('')
    expect(result.current.isDirty).toBe(false)
    expect(result.current.touched).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isSubmitted).toBe(false)
    expect(result.current.submitCount).toBe(0)
  })

  it('a stale submit settling does not end a newer submit started after reset', async () => {
    const submits: Array<ReturnType<typeof deferred<void>>> = []
    const { result } = renderHook(() =>
      useForm({
        defaultValues: { name: '' },
        onSubmit: () => {
          const pending = deferred<void>()
          submits.push(pending)
          return pending.promise
        },
      }),
    )

    let first!: Promise<void>
    await act(async () => {
      first = result.current.handleSubmit()
    })
    await waitFor(() => {
      expect(submits).toHaveLength(1)
    })
    act(() => {
      result.current.reset()
    })
    let second!: Promise<void>
    await act(async () => {
      second = result.current.handleSubmit()
    })
    await waitFor(() => {
      expect(submits).toHaveLength(2)
    })

    await act(async () => {
      submits[0]!.resolve()
      await first
    })
    expect(result.current.isSubmitting).toBe(true)
    expect(result.current.isSubmitted).toBe(false)

    await act(async () => {
      submits[1]!.resolve()
      await second
    })
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.submitCount).toBe(1)
  })
})

describe('untrusted object keys', () => {
  const payload = JSON.parse('{"profile":{"__proto__":{"polluted":true},"name":"x"}}') as {
    profile: { name: string }
  }

  it('mergeDeepPartial ignores __proto__ keys', () => {
    const merged = mergeDeepPartial({ profile: { name: '' } }, payload)
    expect(Object.getPrototypeOf(merged.profile)).toBe(Object.prototype)
    expect((merged.profile as Record<string, unknown>).polluted).toBeUndefined()
    expect(merged.profile.name).toBe('x')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('cloneFormValue ignores __proto__ keys', () => {
    const cloned = cloneFormValue(payload)
    expect(Object.getPrototypeOf(cloned.profile)).toBe(Object.prototype)
    expect((cloned.profile as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('setValues / reset with server payloads keep plain prototypes', () => {
    const { result } = renderHook(() => useForm({ defaultValues: { profile: { name: '' } } }))
    act(() => {
      result.current.setValues(payload)
    })
    expect(Object.getPrototypeOf(result.current.values.profile)).toBe(Object.prototype)
    act(() => {
      result.current.reset(payload)
    })
    expect(Object.getPrototypeOf(result.current.defaultValues.profile)).toBe(Object.prototype)
    expect((result.current.values.profile as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('getValueAtPath does not read inherited Object.prototype members', () => {
    expect(getValueAtPath({}, 'toString')).toBeUndefined()
    expect(getValueAtPath({ a: {} }, 'a.hasOwnProperty')).toBeUndefined()
    expect(getValueAtPath({ list: [1, 2] }, 'list.length')).toBeUndefined()
  })

  it.each([
    '{"__proto__":{"polluted":true}}',
    '{"constructor":{"prototype":{"polluted":true}}}',
    '{"profile":{"constructor":{"prototype":{"polluted":true}}}}',
    '{"items":[{"__proto__":{"polluted":true},"name":"x"}]}',
  ])('no API pollutes Object.prototype with %s', (json) => {
    type Loose = Record<string, unknown>
    const parsed = JSON.parse(json) as Loose
    const nullPrototype = Object.assign(Object.create(null) as Loose, parsed)
    const { result } = renderHook(() =>
      useForm<Loose>({ defaultValues: { profile: { name: '' }, items: [] } }),
    )

    for (const payload of [parsed, nullPrototype]) {
      act(() => {
        result.current.setValues(payload)
        result.current.reset(payload)
        result.current.reset(undefined, { keepDefaultValues: true })
      })
      cloneFormValue(payload)
      mergeDeepPartial({ profile: { name: '' } } as Loose, payload)
    }

    expect(({} as Loose).polluted).toBeUndefined()
    expect(([] as unknown as Loose).polluted).toBeUndefined()
    expect(() => {
      result.current.setValue('profile.__proto__.polluted' as never, true as never)
    }).toThrow()
    expect(() => {
      result.current.setValue('profile.constructor.prototype.polluted' as never, true as never)
    }).toThrow()
    expect(({} as Loose).polluted).toBeUndefined()
  })

  it('keeps safe keys that merely resemble unsafe ones', () => {
    const merged = mergeDeepPartial(
      { proto: '', constructorName: '' },
      { proto: 'a', constructorName: 'b' },
    )
    expect(merged).toEqual({ proto: 'a', constructorName: 'b' })
  })
})

describe('field array keys', () => {
  type Values = { items: Array<{ name: string }> }

  it('items mount once with stable keys from the first render', () => {
    const mounts = vi.fn()
    function Item({ id }: { id: string }) {
      useEffect(() => {
        mounts(id)
      }, [id])
      return <li>{id}</li>
    }
    function List() {
      const form = useForm<Values>({ defaultValues: { items: [{ name: 'a' }, { name: 'b' }] } })
      const { fields } = useFieldArray({ control: form.control, name: 'items' })
      return (
        <ul>
          {fields.map((field) => (
            <Item key={field.key} id={field.key} />
          ))}
        </ul>
      )
    }
    render(<List />)
    expect(mounts).toHaveBeenCalledTimes(2)
  })

  it('keeps keys stable across StrictMode double rendering', () => {
    const seen: string[][] = []
    function List() {
      const form = useForm<Values>({ defaultValues: { items: [{ name: 'a' }] } })
      const { fields, append } = useFieldArray({ control: form.control, name: 'items' })
      seen.push(fields.map((field) => field.key))
      return (
        <button type="button" onClick={() => append({ name: 'b' })}>
          add {fields.length}
        </button>
      )
    }
    render(
      <StrictMode>
        <List />
      </StrictMode>,
    )
    const firstKey = seen[0]?.[0]
    expect(firstKey).toBeDefined()
    act(() => {
      screen.getByRole('button').click()
    })
    const last = seen[seen.length - 1]!
    expect(last).toHaveLength(2)
    expect(last[0]).toBe(firstKey)
  })

  it('local item state follows its item across remove, swap, insert, move, and replace', () => {
    type Api = ReturnType<typeof useFieldArray<Values, 'items'>>
    let api!: Api
    function Item({ testId, value }: { testId: string; value: string }) {
      const [mountedWith] = useState(value)
      return <li data-testid={testId}>{`${mountedWith}:${value}`}</li>
    }
    function List() {
      const form = useForm<Values>({
        defaultValues: { items: [{ name: 'a' }, { name: 'b' }, { name: 'b' }] },
      })
      api = useFieldArray({ control: form.control, name: 'items' })
      return (
        <ul>
          {api.fields.map((field, index) => (
            <Item key={field.key} testId={`item-${index}`} value={field.value.name} />
          ))}
        </ul>
      )
    }
    render(
      <StrictMode>
        <List />
      </StrictMode>,
    )
    const initialKeys = api.fields.map((field) => field.key)
    expect(new Set(initialKeys).size).toBe(3)

    act(() => {
      api.remove(0)
    })
    expect(api.fields.map((field) => field.key)).toEqual(initialKeys.slice(1))

    act(() => {
      api.update(0, { name: 'c' })
    })
    act(() => {
      api.swap(0, 1)
    })
    expect(screen.getByTestId('item-1')).toHaveTextContent('b:c')

    act(() => {
      api.insert(0, { name: 'b' })
    })
    const afterInsert = api.fields.map((field) => field.key)
    expect(afterInsert.slice(1)).toEqual([initialKeys[2], initialKeys[1]])
    expect(initialKeys).not.toContain(afterInsert[0])

    act(() => {
      api.move(2, 0)
    })
    expect(screen.getByTestId('item-0')).toHaveTextContent('b:c')

    act(() => {
      api.replace([{ name: 'a' }])
    })
    expect(afterInsert).not.toContain(api.fields[0]!.key)
  })

  it('server rendering emits final keys (no placeholders) deterministically', () => {
    function List() {
      const form = useForm<Values>({ defaultValues: { items: [{ name: 'a' }, { name: 'b' }] } })
      const { fields } = useFieldArray({ control: form.control, name: 'items' })
      return (
        <ul>
          {fields.map((field) => (
            <li key={field.key} data-key={field.key}>
              {field.value.name}
            </li>
          ))}
        </ul>
      )
    }
    const html = renderToString(<List />)
    expect(html).toBe(renderToString(<List />))
    expect(html).not.toContain('pending')
  })
})

describe('register ref stability', () => {
  it('returns the same ref callback across re-renders for the same field', () => {
    const { result } = renderHook(() => useForm({ defaultValues: { email: '' } }))
    const first = result.current.register('email').ref
    act(() => {
      result.current.setValue('email', 'a')
    })
    expect(result.current.register('email').ref).toBe(first)
  })

  it('a still-mounted input re-registers on its next render after explicit unregister', () => {
    let form!: ReturnType<typeof useForm<{ email: string; other: string }>>
    function Form() {
      form = useForm({ defaultValues: { email: '', other: '' } })
      return <input aria-label="email" {...form.register('email')} />
    }
    render(<Form />)
    act(() => {
      form.unregister('email')
    })
    act(() => {
      form.setValue('other', 'x')
    })
    expect(form.getFieldState('email').registered).toBe(true)
  })

  it('drops the cached ref once the field unmounts, and hands a fresh one to a remount', async () => {
    let form!: ReturnType<typeof useForm<{ email: string }>>
    const refs: unknown[] = []
    function Form({ show }: { show: boolean }) {
      form = useForm({ defaultValues: { email: '' } })
      const props = form.register('email')
      refs.push(props.ref)
      return show ? <input aria-label="email" {...props} /> : null
    }
    const { rerender } = render(<Form show />)
    const mountedRef = refs[refs.length - 1]
    rerender(<Form show={false} />)
    await act(async () => {
      await Promise.resolve()
    })
    rerender(<Form show />)
    expect(refs[refs.length - 1]).not.toBe(mountedRef)
    expect(form.getFieldState('email').registered).toBe(true)
  })

  it('composed refs that drop the cleanup still unregister on unmount', () => {
    let form!: ReturnType<typeof useForm<{ nickname?: string }>>
    function Form({ show }: { show: boolean }) {
      form = useForm<{ nickname?: string }>({ defaultValues: { nickname: '' } })
      const { ref, ...props } = form.register('nickname')
      return show ? (
        <input
          aria-label="nickname"
          {...props}
          ref={(element) => {
            ref(element)
          }}
        />
      ) : null
    }
    const { rerender } = render(<Form show />)
    expect(form.getFieldState('nickname').registered).toBe(true)
    rerender(<Form show={false} />)
    expect(form.getFieldState('nickname').registered).toBe(false)
  })

  it('still focuses the first invalid field after many re-renders', async () => {
    const user = userEvent.setup()
    function Form() {
      const form = useForm({
        defaultValues: { first: '', second: '' },
        rules: { second: [(value: string) => (value ? undefined : 'Required')] },
      })
      return (
        <form onSubmit={form.handleSubmit}>
          <input aria-label="first" {...form.register('first')} />
          <input aria-label="second" {...form.register('second')} />
          <button type="submit">Submit</button>
        </form>
      )
    }
    render(<Form />)
    await user.type(screen.getByLabelText('first'), 'hello')
    await user.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByLabelText('second')).toHaveFocus()
    })
  })

  it('radio options sharing a name register distinct elements', async () => {
    const user = userEvent.setup()
    function Form() {
      const form = useForm({
        defaultValues: { plan: '' },
        rules: { plan: [(value: string) => (value ? undefined : 'Pick one')] },
      })
      return (
        <form onSubmit={form.handleSubmit}>
          <input
            aria-label="free"
            type="radio"
            {...form.register('plan', { type: 'radio', value: 'free' })}
          />
          <input
            aria-label="pro"
            type="radio"
            {...form.register('plan', { type: 'radio', value: 'pro' })}
          />
          <button type="submit">Submit</button>
          <output>{form.values.plan}</output>
        </form>
      )
    }
    render(<Form />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByLabelText('free')).toHaveFocus()
    })
    await user.click(screen.getByLabelText('pro'))
    expect(screen.getByRole('status')).toHaveTextContent('pro')
  })
})

describe('shared derived state for subscribers', () => {
  it('useFieldState / useController / useFormState agree on dirty state', () => {
    type Values = { a: string; b: string }
    const snapshots: Array<{ field: boolean; controller: boolean; form: boolean }> = []
    let control!: FormControl<Values>
    let setA!: (value: string) => void
    function Probe() {
      const field = useFieldState({ control, name: 'a' })
      const { fieldState } = useController({ control, name: 'a' })
      const isDirty = useFormState({ control, selector: (state) => state.dirtyFields.a === true })
      snapshots.push({ field: field.dirty, controller: fieldState.dirty, form: isDirty })
      return null
    }
    function Host({ children }: { children?: ReactNode }) {
      const form = useForm<Values>({ defaultValues: { a: '', b: '' } })
      control = form.control
      setA = (value) => form.setValue('a', value)
      return <>{children}</>
    }
    function App() {
      return (
        <Host>
          <ProbeGate />
        </Host>
      )
    }
    function ProbeGate() {
      return control ? <Probe /> : null
    }
    render(<App />)
    act(() => {
      setA('changed')
    })
    expect(snapshots[snapshots.length - 1]).toEqual({ field: true, controller: true, form: true })
    act(() => {
      setA('')
    })
    expect(snapshots[snapshots.length - 1]).toEqual({
      field: false,
      controller: false,
      form: false,
    })
  })

  it('the shared dirtyFields map is frozen so one consumer cannot corrupt another', () => {
    const { result } = renderHook(() => useForm({ defaultValues: { a: '' } }))
    act(() => {
      result.current.setValue('a', 'x')
    })
    expect(Object.isFrozen(result.current.dirtyFields)).toBe(true)
    expect(result.current.getFieldState('a').dirty).toBe(true)
  })
})

describe('handleSubmit event typing', () => {
  it('accepts any object with preventDefault (e.g. button clicks)', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useForm({ defaultValues: { a: '' }, onSubmit }))
    const preventDefault = vi.fn()
    await act(async () => {
      await result.current.handleSubmit({ preventDefault })
    })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})

/**
 * Regression guard for the DSH 0.1.7 Typert wire contract.
 *
 * Before 0.1.7 a strict codec carried its schema eagerly:
 * `{ mode: 'strict', typeSymbol, schema }`. 0.1.7 replaced that with a lazily
 * materialized factory — `{ mode: 'strict', typeSymbol, create: () => schema }`
 * — because the Host Gateway decodes every parameter and result through
 * `codec.create().parse(value)`. A manifest that kept `schema` still imported
 * fine and only failed late, inside the registry, with
 * `typert: … strict codec has no create() factory`, which made the whole
 * plugin silently disappear from the UI. This test registers the manifest
 * through the real registry so that failure surfaces here instead.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import { apply } from '../lib/index.js'

/** Minimal context that records the typert manifest apply() hands to the registry. */
function captureCtx() {
  const manifests = []
  const ctx = {
    get: () => undefined,
    on: () => () => {},
    effect: (cb) => { const disposer = cb(); return () => { if (typeof disposer === 'function') disposer() } },
    // cordis Service registers the instance back through ctx.reflect.provide.
    reflect: { provide: () => {} },
    logger: { warn() {}, info() {}, error() {}, debug() {} },
    typert: { register: (manifest) => { manifests.push(manifest); return async () => {} } },
  }
  return { ctx, manifests }
}

test('the typert manifest satisfies the 0.1.7 strict-codec contract', () => {
  const { ctx, manifests } = captureCtx()
  apply(ctx)
  assert.equal(manifests.length, 1, 'apply() registers exactly one typert manifest')
  const manifest = manifests[0]

  const registry = new TypertRegistry(ctx)
  assert.doesNotThrow(
    () => registry.register(manifest),
    'the real 0.1.7 registry must accept the manifest (strict codecs need create())',
  )

  for (const descriptor of manifest.invocations) {
    if (descriptor.result.mode === 'strict') {
      assert.equal(typeof descriptor.result.create, 'function', `${descriptor.id} result codec must carry create()`)
    }
    for (const parameter of descriptor.parameters ?? []) {
      if (parameter.codec?.mode === 'strict') {
        assert.equal(typeof parameter.codec.create, 'function', `${descriptor.id} parameter ${parameter.name} codec must carry create()`)
      }
    }
  }
})

test('the registry rejects the pre-0.1.7 codec shape (canary)', () => {
  const { ctx } = captureCtx()
  const registry = new TypertRegistry(ctx)
  const legacy = {
    package: 'dsh-skills-manager-legacy-canary',
    face: 'host',
    schemas: [],
    model: { services: [], events: [], objects: [] },
    invocations: [{
      id: 'dsh-skills-manager-legacy-canary#canary/ping',
      service: 'canary',
      namespace: 'canary',
      method: 'ping',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-skills-manager-legacy-canary#Ping', schema: { parse: (value) => value } },
    }],
  }
  assert.throws(
    () => registry.register(legacy),
    /strict codec has no create\(\) factory/,
    'a codec that still carries `schema` must be rejected — this is the regression the guard exists for',
  )
})

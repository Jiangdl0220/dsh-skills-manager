/**
 * dsh-skills-manager host plugin: exposes the skills-management Remote to the
 * browser through the official Typert Gateway. Reads go through `ctx.skills`
 * (the authoritative catalog) plus a guarded scan of the user skill roots;
 * mutations rename or move skill files inside those roots and the
 * plugin-owned trash root only. Desktop + web compatible: only official DSH
 * contracts are used, no desktop-only services are injected.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
import { SkillsManagerRuntime } from './runtime.ts'
import { SKILLS_MANAGER_MANIFEST } from './typert.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = '@jiangdaoli/dsh-skills-manager'

/** Services required before load: the Typert registry (wire manifest). */
export const inject = ['typert']

/**
 * Mount the skills-manager Remote service and its strict Typert manifest.
 * @param ctx - host cordis context.
 */
export function apply(ctx: Context): void {
  new SkillsManagerRuntime(ctx)
  // Strict endpoint registration: the gateway resolves skills-manager/* from
  // this manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(SKILLS_MANAGER_MANIFEST)
    return () => {
      void dispose()
    }
  }, 'dsh-skills-manager: typert manifest')
}

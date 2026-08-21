/**
 * dsh-skills-manager client plugin: the browser half. Mounts the
 * `skills-manager` Remote namespace and registers the «技能管理» settings
 * section — the full installed-skill list with enable/disable/trash/restore/
 * delete-forever actions. Desktop and web share this bundle; no desktop-only
 * service is used.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { NS, en, fmt, zh, type Translate } from './locales.ts'
import { SKILLS_MANAGER_REMOTE, type SkillsManagerNamespaceFace } from './remote.ts'
import { SettingsSection } from './SettingsSection.tsx'
import { adoptStyles } from './styles.ts'
import { clearState, mountState } from './state.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = '@jiangdaoli/dsh-skills-manager'

/** Required services: Remote gateway, slot system, and locale. */
export const inject = ['remote', 'slots', 'locale']

/**
 * Compose the skills-manager surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, 'zh', zh), 'dsh-skills-manager: zh dictionary')
  ctx.effect(() => ctx.locale.register(NS, 'en', en), 'dsh-skills-manager: en dictionary')
  const bound = ctx.locale.bind(NS)
  const t: Translate = (key, params) => fmt(bound(key), params)

  // The mounted namespace handle resolves through the service store
  // (`ctx.reflect.get`), not through `ctx.remote.skillsManager` (the dotted
  // read walks the cordis fiber chain, which stops at the Loader's
  // runtime-less internal forks). The section component reads the handle
  // from the module holder.
  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(SKILLS_MANAGER_REMOTE)
    const face = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.skills-manager') as
      | SkillsManagerNamespaceFace
      | undefined
    if (face === undefined) {
      void dispose()
      throw new Error('dsh-skills-manager: the skills-manager Remote namespace did not mount')
    }
    mountState(face, t)
    return () => {
      clearState()
      void dispose()
    }
  }, 'dsh-skills-manager: remote')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills',
    order: 30,
    label: () => t('nav'),
  }, SettingsSection))
}

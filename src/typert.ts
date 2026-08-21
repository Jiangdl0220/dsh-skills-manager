/**
 * The hand-written host Typert manifest for the skills-manager Remote.
 * Registered through `ctx.typert.register` in the plugin body, it claims the
 * wire endpoints through the strict registry so the Host Gateway resolves
 * `skills-manager/list`, `skills-manager/set-enabled`, `skills-manager/trash`,
 * `skills-manager/restore` and `skills-manager/delete-forever` without
 * consulting the `@Remote` marker table (marker independence matters in
 * source-launch development environments).
 */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { SKILLS_MANAGER_INVOCATIONS } from './contract.ts'

/** The skills-manager namespace's host manifest (strict codecs shared with the client). */
export const SKILLS_MANAGER_MANIFEST: TypertContribution = {
  package: 'dsh-skills-manager',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'skills-manager',
        exportName: 'SkillsManagerRuntime',
        description: 'List installed skills, enable/disable without uninstalling, move to and restore from the plugin trash.',
        tags: [],
        members: [
          {
            kind: 'method',
            name: 'list',
            signature: 'list(): Promise<{ skills: SkillEntry[] }>',
          },
          {
            kind: 'method',
            name: 'setEnabled',
            signature: 'setEnabled(request: SetEnabledRequest): Promise<{ enabled: boolean }>',
          },
          {
            kind: 'method',
            name: 'trash',
            signature: 'trash(request: TrashRequest): Promise<{ trashed: true }>',
          },
          {
            kind: 'method',
            name: 'restore',
            signature: 'restore(request: RestoreRequest): Promise<{ restored: true }>',
          },
          {
            kind: 'method',
            name: 'deleteForever',
            signature: 'deleteForever(request: DeleteForeverRequest): Promise<{ deleted: true }>',
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: SKILLS_MANAGER_INVOCATIONS,
}

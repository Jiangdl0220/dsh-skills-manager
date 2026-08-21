/**
 * The skills-manager wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). The host reads the skill catalog
 * through the official `ctx.skills` registry and mutates only files inside the
 * user skill roots (`~/.dsh/skills`, `~/.agents/skills`) and the plugin-owned
 * trash root; bundled/built-in skills are never touched.
 */
import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** One row in the skills-management list. */
export interface SkillEntry {
  readonly name: string
  readonly description: string
  readonly whenToUse: string | null
  readonly modelInvocable: boolean
  /** filesystem root kind the skill came from. */
  readonly source: string
  /** user-facing source label (用户 / 内置 / …). */
  readonly sourceLabel: string
  readonly provider: string
  /** enabled | disabled | trashed */
  readonly state: string
  readonly manageable: boolean
  readonly readOnlyReason: string | null
  /** dir for directory skills, the loose `.md` file path for file skills. */
  readonly kind: string
  /** container path: the trash target (dir or loose file). */
  readonly path: string | null
  /** the SKILL.md (or `<name>.md`) path whose rename toggles enabled state. */
  readonly manageFile: string | null
  /** the `.disabled` counterpart of `manageFile`. */
  readonly manageFileDisabled: string | null
  /** trashed entries: the trash directory holding the skill. */
  readonly trashDir: string | null
  /** trashed entries: original container path before trashing. */
  readonly originalPath: string | null
  /** trashed entries: when the skill was trashed (ms epoch). */
  readonly trashedAt: number | null
}
export const skillEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  whenToUse: z.string().nullable(),
  modelInvocable: z.boolean(),
  source: z.string(),
  sourceLabel: z.string(),
  provider: z.string(),
  state: z.string(),
  manageable: z.boolean(),
  readOnlyReason: z.string().nullable(),
  kind: z.string(),
  path: z.string().nullable(),
  manageFile: z.string().nullable(),
  manageFileDisabled: z.string().nullable(),
  trashDir: z.string().nullable(),
  originalPath: z.string().nullable(),
  trashedAt: z.number().nullable(),
}).readonly()

/** The full management list: active, disabled, and trashed skills. */
export const skillListResultSchema = z.object({
  skills: z.array(skillEntrySchema),
}).readonly()

/** Enable or disable one installed skill (renames its SKILL.md file). */
export interface SetEnabledRequest {
  readonly name: string
  /** the manageFile path (or its `.disabled` counterpart) from the list. */
  readonly path: string
  readonly enabled: boolean
}
export const setEnabledRequestSchema = z.object({
  name: z.string(),
  path: z.string(),
  enabled: z.boolean(),
}).readonly()

export const setEnabledResultSchema = z.object({
  enabled: z.boolean(),
}).readonly()

/** Move one installed skill into the plugin trash root. */
export interface TrashRequest {
  readonly name: string
  /** the container path (dir or loose file) from the list. */
  readonly path: string
}
export const trashRequestSchema = z.object({
  name: z.string(),
  path: z.string(),
}).readonly()

export const trashResultSchema = z.object({
  trashed: z.boolean(),
}).readonly()

/** Restore one trashed skill to its original location. */
export interface RestoreRequest {
  readonly name: string
  /** the trash directory holding the skill. */
  readonly trashDir: string
}
export const restoreRequestSchema = z.object({
  name: z.string(),
  trashDir: z.string(),
}).readonly()

export const restoreResultSchema = z.object({
  restored: z.boolean(),
}).readonly()

/** Permanently delete one trashed skill (irreversible). */
export interface DeleteForeverRequest {
  readonly name: string
  /** the trash directory holding the skill. */
  readonly trashDir: string
}
export const deleteForeverRequestSchema = z.object({
  name: z.string(),
  trashDir: z.string(),
}).readonly()

export const deleteForeverResultSchema = z.object({
  deleted: z.boolean(),
}).readonly()

/** The skills-manager Remote namespace's strict invocation descriptors. */
export const SKILLS_MANAGER_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-skills-manager#skills-manager/list',
    service: 'skills-manager',
    namespace: 'skills-manager',
    method: 'list',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-skills-manager#SkillListResult',
      schema: skillListResultSchema,
    },
  },
  {
    id: 'dsh-skills-manager#skills-manager/set-enabled',
    service: 'skills-manager',
    namespace: 'skills-manager',
    method: 'setEnabled',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-skills-manager#SetEnabledRequest',
          schema: setEnabledRequestSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-skills-manager#SetEnabledResult',
      schema: setEnabledResultSchema,
    },
  },
  {
    id: 'dsh-skills-manager#skills-manager/trash',
    service: 'skills-manager',
    namespace: 'skills-manager',
    method: 'trash',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-skills-manager#TrashRequest',
          schema: trashRequestSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-skills-manager#TrashResult',
      schema: trashResultSchema,
    },
  },
  {
    id: 'dsh-skills-manager#skills-manager/restore',
    service: 'skills-manager',
    namespace: 'skills-manager',
    method: 'restore',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-skills-manager#RestoreRequest',
          schema: restoreRequestSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-skills-manager#RestoreResult',
      schema: restoreResultSchema,
    },
  },
  {
    id: 'dsh-skills-manager#skills-manager/delete-forever',
    service: 'skills-manager',
    namespace: 'skills-manager',
    method: 'deleteForever',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'dsh-skills-manager#DeleteForeverRequest',
          schema: deleteForeverRequestSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-skills-manager#DeleteForeverResult',
      schema: deleteForeverResultSchema,
    },
  },
]

/** The gateway result shape the client face resolves to. */
export type RemoteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

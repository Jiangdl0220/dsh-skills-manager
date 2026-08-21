/**
 * The client-side Typert Remote contribution for the skills-manager host
 * service: mounts the shared strict descriptors into `ctx.remote.skillsManager`.
 * The descriptors and codecs come from the shared contract module, so the
 * browser bundle and the host manifest stay on one wire definition.
 */
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { SKILLS_MANAGER_INVOCATIONS } from '../contract.ts'
import type { RemoteResult, SkillEntry } from '../contract.ts'

/** The skills-manager Remote namespace's client contribution. */
export const SKILLS_MANAGER_REMOTE: TypertRemoteContribution = {
  package: 'dsh-skills-manager',
  descriptors: SKILLS_MANAGER_INVOCATIONS,
}

/** The callable face of the mounted `remote.skillsManager` namespace. */
export interface SkillsManagerNamespaceFace {
  list(): Promise<RemoteResult<{ skills: SkillEntry[] }>>
  setEnabled(request: { name: string; path: string; enabled: boolean }): Promise<RemoteResult<{ enabled: boolean }>>
  trash(request: { name: string; path: string }): Promise<RemoteResult<{ trashed: true }>>
  restore(request: { name: string; trashDir: string }): Promise<RemoteResult<{ restored: true }>>
  deleteForever(request: { name: string; trashDir: string }): Promise<RemoteResult<{ deleted: true }>>
}

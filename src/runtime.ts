/**
 * The dsh-skills-manager host Remote service (`ctx.skillsManager`, wire
 * namespace `skills-manager`). Registered as a TypertRemoteService so the
 * Host Gateway exposes `skills-manager/list`, `skills-manager/set-enabled`,
 * `skills-manager/trash`, `skills-manager/restore` and
 * `skills-manager/delete-forever` to the Web client. All reads go through
 * the official `ctx.skills` registry plus a guarded scan of the user skill
 * roots; all mutations are guarded file operations confined to those roots
 * and the plugin-owned trash root.
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  DeleteForeverRequest,
  RestoreRequest,
  SetEnabledRequest,
  SkillEntry,
  TrashRequest,
} from './contract.ts'
import {
  deleteSkillForever,
  listManagedSkills,
  resolveRoots,
  restoreSkill,
  setSkillEnabled,
  trashSkill,
  type CatalogSummaryLike,
  type FsLike,
  type ShellLike,
} from './core.ts'

/** The DSH home directory (defaults match the filesystem skill provider). */
function dshHome(): string {
  return process.env.DSH_HOME ?? `${process.env.HOME ?? ''}/.dsh`
}

/** Runtime service: skill management for the web settings page. */
export class SkillsManagerRuntime extends TypertRemoteService {
  private readonly home: { dshHome: string; agentsHome?: string }

  constructor(ctx: Context, home: { dshHome: string; agentsHome?: string } = { dshHome: dshHome() }) {
    super(ctx, 'skills-manager')
    this.home = home
  }

  /** The full management list: enabled, disabled, and trashed skills. */
  @Remote
  async list(): Promise<{ skills: SkillEntry[] }> {
    const fs = this.ctx.get('fs') as FsLike | undefined
    if (fs === undefined) throw new Error('fs service unavailable')
    const skills = this.ctx.get('skills') as
      | { list(options?: { cwd?: string }): Promise<CatalogSummaryLike[]> }
      | undefined
    const roots = resolveRoots(this.home)
    const entries = await listManagedSkills(fs, skills, roots)
    return { skills: entries }
  }

  /** Enable or disable one installed skill. */
  @Remote
  async setEnabled(request: SetEnabledRequest): Promise<{ enabled: boolean }> {
    const { fs, shell } = requireFsShell(this.ctx)
    const roots = resolveRoots(this.home)
    await setSkillEnabled(fs, shell, roots, request.name, request.path, request.enabled)
    return { enabled: request.enabled }
  }

  /** Move one installed skill into the plugin trash root. */
  @Remote
  async trash(request: TrashRequest): Promise<{ trashed: true }> {
    const { fs, shell } = requireFsShell(this.ctx)
    const roots = resolveRoots(this.home)
    await trashSkill(fs, shell, roots, request.name, request.path)
    return { trashed: true }
  }

  /** Restore one trashed skill to its original location. */
  @Remote
  async restore(request: RestoreRequest): Promise<{ restored: true }> {
    const { fs, shell } = requireFsShell(this.ctx)
    const roots = resolveRoots(this.home)
    await restoreSkill(fs, shell, roots, request.name, request.trashDir)
    return { restored: true }
  }

  /** Permanently delete one trashed skill (irreversible). */
  @Remote
  async deleteForever(request: DeleteForeverRequest): Promise<{ deleted: true }> {
    const { fs, shell } = requireFsShell(this.ctx)
    const roots = resolveRoots(this.home)
    await deleteSkillForever(fs, shell, roots, request.name, request.trashDir)
    return { deleted: true }
  }
}

function requireFsShell(ctx: Context): { fs: FsLike; shell: ShellLike } {
  const fs = ctx.get('fs') as FsLike | undefined
  if (fs === undefined) throw new Error('fs service unavailable')
  const shell = ctx.get('shell') as ShellLike | undefined
  if (shell === undefined) throw new Error('shell service unavailable (技能文件操作需要 shell 服务)')
  return { fs, shell }
}

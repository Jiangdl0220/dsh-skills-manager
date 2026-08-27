/**
 * The skills-manager core: user-root scanning, catalog merging, the path
 * guard, and the guarded filesystem mutations (enable/disable/trash/restore/
 * delete-forever). All DSH services are consumed through minimal structural
 * faces so the logic is unit-testable with fakes and never touches anything
 * outside the user skill roots (`~/.dsh/skills`, `~/.agents/skills`) and the
 * plugin-owned trash root (`~/.dsh/.skill-trash`).
 */
import type { SkillEntry } from './contract.ts'

/** Minimal structural face of `ctx.fs` (the subset the core uses). */
export interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTargetLike>
  contains(parent: FsTargetLike, child: FsTargetLike): boolean
  stat(target: FsTargetLike, signal?: AbortSignal): Promise<{ type?: string } | undefined>
  listDir(target: FsTargetLike, signal?: AbortSignal): Promise<FsDirEntryLike[]>
  readText(target: FsTargetLike, signal?: AbortSignal): Promise<string>
  writeText(target: FsTargetLike, content: string, expected?: unknown, signal?: AbortSignal): Promise<unknown>
}
export interface FsTargetLike {
  readonly targetKey: string
  readonly displayPath: string
}
export interface FsDirEntryLike {
  readonly name: string
  readonly type: string
  readonly target: FsTargetLike
}

/** Minimal structural face of `ctx.shell`. */
export interface ShellLike {
  resolve(request: { command: string; timeoutMs?: number; cwd?: string }): unknown
  run(spec: unknown): Promise<{ exitCode: number; stdout: string; stderr: string }>
}

/** Minimal structural face of `ctx.skills.list()` summaries. */
export interface CatalogSummaryLike {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly invocation?: { readonly modelInvocable?: boolean; readonly userInvocable?: boolean }
  readonly source?: string
  readonly provider?: string
  readonly resourceBase?: { readonly kind?: string; readonly path?: string }
}

/** The user-level skill roots the manager owns. */
export interface SkillRoots {
  readonly userDsh: string
  readonly userAgents: string
  readonly trash: string
}

/** Resolve the managed roots from the DSH home environment. */
export function resolveRoots(home: { dshHome: string; agentsHome?: string }): SkillRoots {
  const agents = home.agentsHome ?? `${home.dshHome}/../.agents`
  return {
    userDsh: `${home.dshHome}/skills`,
    userAgents: `${agents}/skills`,
    trash: `${home.dshHome}/.skill-trash`,
  }
}

/** One disk-level skill instance found under a user root. */
export interface DiskSkill {
  readonly name: string
  readonly description: string
  readonly whenToUse: string | null
  readonly rootLabel: '用户' | '用户'
  readonly source: 'user-dsh' | 'user-agents'
  readonly root: string
  readonly kind: 'dir' | 'file'
  readonly container: string
  readonly manageFile: string
  readonly manageFileDisabled: string
  readonly state: 'enabled' | 'disabled'
  readonly provider: string
  readonly modelInvocable: boolean
}

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  'user-dsh': '用户',
  'user-agents': '用户',
  'project-dsh': '项目',
  'project-agents': '项目',
  bundled: '内置',
  custom: '自定义',
}

/** User-facing source label for a catalog source kind. */
export function sourceLabel(source: string | undefined, provider: string): string {
  if (source !== undefined && SOURCE_LABEL[source] !== undefined) return SOURCE_LABEL[source]
  return provider === 'filesystem' ? '用户' : provider
}

/**
 * Light frontmatter reader: tolerant of malformed YAML, extracts the fields
 * the manager displays. Handles single-line values, quoted values, and YAML
 * block scalars (`|` literal, `>` folded) — the shipped skill parser only
 * reads a single-line `description:` and leaks the bare `|`/`>` indicator,
 * which is why a list rendered those as a lone punctuation char.
 */
export function parseLightFrontmatter(raw: string): { name?: string; description?: string; whenToUse?: string } {
  const text = raw.length > 8000 ? raw.slice(0, 8000) : raw
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (m === undefined || m === null) return {}
  const lines = m[1].split(/\r?\n/)
  const out: { name?: string; description?: string; whenToUse?: string } = {}
  let i = 0
  while (i < lines.length) {
    const kv = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(lines[i])
    if (kv === undefined || kv === null) { i++; continue }
    const key = kv[1]
    const trailing = kv[2].trim()
    const block = /^([|>])([+-]?)(?:[ \t]*#.*)?$/.exec(trailing)
    let value: string
    if (block !== null) {
      // YAML block scalar: collect the following more-indented lines.
      const style = block[1] as '|' | '>'
      const collected: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const l = lines[j]
        if (l !== '' && !/^[ \t]/.test(l)) break
        collected.push(l)
        j++
      }
      value = renderBlockScalar(style, collected)
      i = j
    } else {
      value = unquote(trailing)
      i++
    }
    if (key === 'name') out.name = value
    else if (key === 'description') out.description = value
    else if (key === 'whenToUse') out.whenToUse = value
  }
  return out
}

/** Render a collected YAML block-scalar body (indented lines) per its style. */
function renderBlockScalar(style: '|' | '>', collected: string[]): string {
  let start = 0
  while (start < collected.length && collected[start].trim() === '') start++
  let end = collected.length - 1
  while (end >= start && collected[end].trim() === '') end--
  if (end < start) return ''
  const body = collected.slice(start, end + 1)
  const indents = body
    .filter((l) => l.trim() !== '')
    .map((l) => (/^[ \t]*/.exec(l) !== null ? (/^[ \t]*/.exec(l) as RegExpExecArray)[0].length : 0))
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0
  const deindented = body.map((l) => l.slice(minIndent).replace(/[ \t]+$/, ''))
  if (style === '|') return deindented.join('\n').trim()
  // folded: single newlines fold to a space, a blank line becomes a newline
  let result = ''
  let sawBlank = false
  for (const l of deindented) {
    const t = l.trim()
    if (t === '') { sawBlank = true; continue }
    if (result !== '') result += sawBlank ? '\n' : ' '
    result += t
    sawBlank = false
  }
  return result.trim()
}

function unquote(value: string): string {
  const v = value.trim()
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1)
  }
  return v
}

/** True when a string is just a leaked YAML block-scalar indicator (e.g. `|`, `>-`). */
function isBlockIndicator(value: string): boolean {
  return /^[|>][+-]?$/.test(value.trim())
}

/** Prefer the disk-read description over the catalog one: the catalog sometimes
 * leaks a `|`/`>` indicator, which must never win over real text. */
function preferDescription(disk: string, catalog: string): string {
  const usable = (s: string): boolean => s.trim() !== '' && !isBlockIndicator(s)
  if (usable(disk)) return disk
  if (usable(catalog)) return catalog
  return disk
}

/** Best-effort description read straight from a skill container's SKILL.md
 * (handles the `.disabled` twin), falling back to `fallback` on any failure. */
async function describeFromDisk(fs: FsLike, container: string | null, fallback: string): Promise<string> {
  if (container === null) return fallback
  for (const md of [`${container}/SKILL.md`, `${container}/SKILL.md.disabled`]) {
    const raw = await tryRead(fs, md)
    if (raw === undefined) continue
    const parsed = parseLightFrontmatter(raw)
    return preferDescription(parsed.description ?? '', fallback)
  }
  return fallback
}

/** A catalog row the scan merged into a disk skill (or emitted read-only). */
interface CatalogRow {
  summary: CatalogSummaryLike
  container: string | null
}

/**
 * Scan the user skill roots and merge with the authoritative catalog.
 * @param fs - the fs service face.
 * @param skills - the skills registry face (may be undefined).
 * @param roots - the managed roots.
 * @returns every user-level skill (enabled + disabled) plus read-only catalog rows.
 */
export async function listManagedSkills(
  fs: FsLike,
  skills: { list(options?: { cwd?: string }): Promise<CatalogSummaryLike[]> } | undefined,
  roots: SkillRoots,
): Promise<SkillEntry[]> {
  const disk = await scanUserRoots(fs, roots)
  const catalog: CatalogRow[] = []
  if (skills !== undefined) {
    try {
      const summaries = await skills.list({})
      for (const summary of summaries) {
        const base = summary.resourceBase
        catalog.push({ summary, container: base?.kind === 'directory' && typeof base.path === 'string' ? base.path : null })
      }
    } catch {
      /* catalog unavailable: fall back to pure disk scan */
    }
  }

  const byContainer = new Map<string, CatalogSummaryLike>()
  const byNameAndRoot = new Map<string, CatalogSummaryLike>()
  for (const row of catalog) {
    const key = `${row.summary.source ?? ''}\u0000${row.summary.name}`
    if (!byNameAndRoot.has(key)) byNameAndRoot.set(key, row.summary)
    if (row.container !== null) {
      const containerKey = normalizePath(row.container)
      if (!byContainer.has(containerKey)) byContainer.set(containerKey, row.summary)
    }
  }

  const entries: SkillEntry[] = []
  const seenContainers = new Set<string>()

  for (const skill of disk) {
    const containerKey = normalizePath(skill.container)
    seenContainers.add(containerKey)
    // Prefer the exact container match; fall back to the name+source match so
    // a realpath-normalization drift between the catalog locator and the disk
    // scan still attaches the catalog metadata.
    const meta = byContainer.get(containerKey) ?? byNameAndRoot.get(`${skill.source}\u0000${skill.name}`)
    const description = preferDescription(skill.description, meta?.description ?? '')
    const whenToUse = meta?.whenToUse ?? skill.whenToUse
    entries.push({
      name: skill.name,
      description,
      whenToUse: whenToUse ?? null,
      modelInvocable: meta?.invocation?.modelInvocable ?? true,
      source: skill.source,
      sourceLabel: '用户',
      provider: skill.provider,
      state: skill.state,
      manageable: true,
      readOnlyReason: null,
      kind: skill.kind,
      path: skill.container,
      manageFile: skill.manageFile,
      manageFileDisabled: skill.manageFileDisabled,
      trashDir: null,
      originalPath: null,
      trashedAt: null,
    })
  }

  // Catalog rows that are not backed by a user-root file (bundled, custom,
  // runtime, project) surface as read-only entries so the page shows the
  // whole catalog next to the manageable set. For user roots the disk scan is
  // authoritative: a user-* row whose container no longer exists is trashed
  // or permanently gone — never show a phantom row (the trash scan reports
  // trashed ones).
  for (const row of catalog) {
    if (row.container !== null && seenContainers.has(normalizePath(row.container))) continue
    const summary = row.summary
    const source = summary.source ?? 'other'
    if (source === 'user-dsh' || source === 'user-agents') {
      const base = summary.resourceBase
      if (base?.kind !== 'directory' || typeof base.path !== 'string') continue
      const containerTarget = await safeResolve(fs, base.path)
      if (containerTarget === undefined) continue
      const info = await safeStat(fs, containerTarget)
      if (info?.type !== 'directory') continue
    }
    const base = summary.resourceBase
    const container = row.container
    const description = await describeFromDisk(fs, container, summary.description)
    entries.push({
      name: summary.name,
      description,
      whenToUse: summary.whenToUse ?? null,
      modelInvocable: summary.invocation?.modelInvocable ?? true,
      source,
      sourceLabel: sourceLabel(source, summary.provider ?? ''),
      provider: summary.provider ?? '',
      state: 'enabled',
      manageable: false,
      readOnlyReason: source === 'bundled'
        ? '内置技能不可停用或删除'
        : (summary.provider === 'filesystem' ? '未找到技能文件' : '非文件系统技能'),
      kind: base?.kind === 'directory' ? 'dir' : 'other',
      path: base?.kind === 'directory' && typeof base.path === 'string' ? base.path : null,
      manageFile: null,
      manageFileDisabled: null,
      trashDir: null,
      originalPath: null,
      trashedAt: null,
    })
  }

  const trashed = await scanTrash(fs, roots)
  entries.push(...trashed)

  entries.sort((a, b) => {
    const rank = (e: SkillEntry): number => (e.state === 'enabled' ? 0 : e.state === 'disabled' ? 1 : 2)
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    if (a.state === 'trashed' && b.state === 'trashed') return (b.trashedAt ?? 0) - (a.trashedAt ?? 0)
    return a.name.localeCompare(b.name)
  })
  return entries
}

async function scanUserRoots(fs: FsLike, roots: SkillRoots): Promise<DiskSkill[]> {
  const out: DiskSkill[] = []
  for (const [root, source] of [[roots.userDsh, 'user-dsh'], [roots.userAgents, 'user-agents']] as const) {
    const dirTarget = await safeResolve(fs, root)
    if (dirTarget === undefined) continue
    let entries: FsDirEntryLike[]
    try {
      entries = await fs.listDir(dirTarget)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.type === 'directory') {
        const dir = entry.target.displayPath
        const manageFile = `${dir}/SKILL.md`
        const manageFileDisabled = `${dir}/SKILL.md.disabled`
        const state = await probeSkillFile(fs, manageFile, manageFileDisabled)
        if (state === undefined) continue
        const parsed = state === 'enabled' ? await tryParse(fs, manageFile) : await tryParse(fs, manageFileDisabled)
        out.push({
          name: parsed.name ?? entry.name,
          description: parsed.description ?? '',
          whenToUse: parsed.whenToUse ?? null,
          rootLabel: '用户',
          source,
          root,
          kind: 'dir',
          container: dir,
          manageFile,
          manageFileDisabled,
          state,
          provider: 'filesystem',
          modelInvocable: true,
        })
      } else if (entry.type === 'file' && entry.name.endsWith('.md') && !entry.name.endsWith('.md.disabled')) {
        const file = entry.target.displayPath
        const manageFile = file
        const manageFileDisabled = `${file}.disabled`
        const state = await probeSkillFile(fs, manageFile, manageFileDisabled)
        if (state === undefined) continue
        const parsed = state === 'enabled' ? await tryParse(fs, manageFile) : await tryParse(fs, manageFileDisabled)
        out.push({
          name: parsed.name ?? entry.name.replace(/\.md$/, ''),
          description: parsed.description ?? '',
          whenToUse: parsed.whenToUse ?? null,
          rootLabel: '用户',
          source,
          root,
          kind: 'file',
          container: file,
          manageFile,
          manageFileDisabled,
          state,
          provider: 'filesystem',
          modelInvocable: true,
        })
      }
    }
  }
  return out
}

async function scanTrash(fs: FsLike, roots: SkillRoots): Promise<SkillEntry[]> {
  const trashTarget = await safeResolve(fs, roots.trash)
  if (trashTarget === undefined) return []
  let entries: FsDirEntryLike[]
  try {
    entries = await fs.listDir(trashTarget)
  } catch {
    return []
  }
  const out: SkillEntry[] = []
  for (const entry of entries) {
    if (entry.type !== 'directory') continue
    const trashDir = entry.target.displayPath
    const sidecar = await tryRead(fs, `${trashDir}.json`)
    let name = entry.name.replace(/-\d+$/, '')
    let originalPath: string | null = null
    let trashedAt: number | null = null
    if (sidecar !== undefined) {
      try {
        const meta = JSON.parse(sidecar) as { name?: string; originalPath?: string; trashedAt?: number }
        if (typeof meta.name === 'string' && meta.name !== '') name = meta.name
        if (typeof meta.originalPath === 'string') originalPath = meta.originalPath
        if (typeof meta.trashedAt === 'number') trashedAt = meta.trashedAt
      } catch {
        /* tolerate malformed sidecar */
      }
    }
    out.push({
      name,
      description: await describeFromDisk(fs, trashDir, ''),
      whenToUse: null,
      modelInvocable: true,
      source: 'trash',
      sourceLabel: '回收站',
      provider: 'filesystem',
      state: 'trashed',
      manageable: true,
      readOnlyReason: null,
      kind: 'dir',
      path: trashDir,
      manageFile: null,
      manageFileDisabled: null,
      trashDir,
      originalPath,
      trashedAt,
    })
  }
  return out
}

async function probeSkillFile(
  fs: FsLike,
  active: string,
  disabled: string,
): Promise<'enabled' | 'disabled' | undefined> {
  const activeTarget = await safeResolve(fs, active)
  if (activeTarget !== undefined) {
    const info = await safeStat(fs, activeTarget)
    if (info?.type === 'file') return 'enabled'
  }
  const disabledTarget = await safeResolve(fs, disabled)
  if (disabledTarget !== undefined) {
    const info = await safeStat(fs, disabledTarget)
    if (info?.type === 'file') return 'disabled'
  }
  return undefined
}

async function tryParse(fs: FsLike, path: string): Promise<{ name?: string; description?: string; whenToUse?: string }> {
  const raw = await tryRead(fs, path)
  if (raw === undefined) return {}
  return parseLightFrontmatter(raw)
}

async function tryRead(fs: FsLike, path: string): Promise<string | undefined> {
  const target = await safeResolve(fs, path)
  if (target === undefined) return undefined
  try {
    return await fs.readText(target)
  } catch {
    return undefined
  }
}

async function safeResolve(fs: FsLike, path: string): Promise<FsTargetLike | undefined> {
  try {
    return await fs.resolve(path)
  } catch {
    return undefined
  }
}

async function safeStat(fs: FsLike, target: FsTargetLike): Promise<{ type?: string } | undefined> {
  try {
    return await fs.stat(target)
  } catch {
    return undefined
  }
}

/** Normalize a canonical path for map keys. */
function normalizePath(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path
}

/** Shell-quote a path for safe interpolation into a `mv`/`rm` command. */
export function shellQuote(path: string): string {
  return `'${path.replace(/'/g, `'\\''`)}'`
}

/** Run one guarded shell mutation; throws a user-readable error on nonzero exit. */
export async function runShellCommand(shell: ShellLike, command: string): Promise<void> {
  const spec = shell.resolve({ command, timeoutMs: 20000 })
  const result = await shell.run(spec)
  if (result.exitCode !== 0) {
    const detail = (result.stderr ?? '').trim() !== '' ? result.stderr.trim() : result.stdout.trim()
    throw new Error(`命令执行失败 (exit ${result.exitCode})${detail !== '' ? `: ${detail}` : ''}`)
  }
}

/**
 * Guard a path against escaping the managed roots. Returns the canonical path
 * (via `fs.resolve`) when the path is inside `root`; throws otherwise.
 */
export async function guardInside(fs: FsLike, root: string, path: string, subject: string): Promise<string> {
  const rootTarget = await safeResolve(fs, root)
  if (rootTarget === undefined) throw new Error(`${subject} 根目录不可用: ${root}`)
  const target = await safeResolve(fs, path)
  if (target === undefined) throw new Error(`${subject} 路径不存在: ${path}`)
  if (!fs.contains(rootTarget, target)) {
    throw new Error(`路径越界，拒绝操作: ${path}`)
  }
  const relative = target.displayPath.slice(rootTarget.displayPath.length).replace(/^[/\\]+/, '')
  if (relative === '' || relative === '..' || relative.startsWith('../') || relative.includes('/../')) {
    throw new Error(`路径非法，拒绝操作: ${path}`)
  }
  return target.displayPath
}

/** The exact SKILL.md file name for directory skills. */
const SKILL_FILE = 'SKILL.md'

/**
 * Toggle one skill between enabled and disabled by renaming its manage file.
 * @param fs - fs service face.
 * @param shell - shell service face.
 * @param roots - managed roots.
 * @param name - skill name (for error messages).
 * @param path - the manageFile path from the list (or its `.disabled` twin).
 * @param enabled - target state.
 */
export async function setSkillEnabled(
  fs: FsLike,
  shell: ShellLike,
  roots: SkillRoots,
  name: string,
  path: string,
  enabled: boolean,
): Promise<void> {
  const canonical = await guardInside(fs, roots.userDsh, path, '技能').catch(async () => {
    return await guardInside(fs, roots.userAgents, path, '技能')
  })
  const base = canonical.replace(/\.disabled$/, '')
  const baseName = base.slice(base.lastIndexOf('/') + 1)
  if (baseName !== SKILL_FILE && !baseName.endsWith('.md')) {
    throw new Error(`不是可管理的技能文件: ${canonical}`)
  }
  const source = enabled ? `${base}.disabled` : base
  const dest = enabled ? base : `${base}.disabled`
  const sourceTarget = await safeResolve(fs, source)
  if (sourceTarget === undefined) throw new Error(`找不到 ${enabled ? '已停用' : '技能'}文件: ${source}`)
  const info = await safeStat(fs, sourceTarget)
  if (info?.type !== 'file') throw new Error(`技能文件不是常规文件: ${source}`)
  await runShellCommand(shell, `mv -- ${shellQuote(source)} ${shellQuote(dest)}`)
}

/**
 * Move one installed skill into the plugin trash root (restorable).
 * @param fs - fs service face.
 * @param shell - shell service face.
 * @param roots - managed roots.
 * @param name - skill name.
 * @param path - the container path (dir or loose file) from the list.
 */
export async function trashSkill(
  fs: FsLike,
  shell: ShellLike,
  roots: SkillRoots,
  name: string,
  path: string,
): Promise<void> {
  const canonical = await guardInside(fs, roots.userDsh, path, '技能').catch(async () => {
    return await guardInside(fs, roots.userAgents, path, '技能')
  })
  await runShellCommand(shell, `mkdir -p -- ${shellQuote(roots.trash)}`)
  const safeName = name.replace(/[^A-Za-z0-9_.-]/g, '-').replace(/^-+|-+$/g, '') || 'skill'
  const stamp = Date.now()
  const trashEntry = `${roots.trash}/${safeName}-${stamp}`
  await runShellCommand(shell, `mv -- ${shellQuote(canonical)} ${shellQuote(trashEntry)}`)
  const sidecar = `${trashEntry}.json`
  const sidecarTarget = await safeResolve(fs, sidecar)
  if (sidecarTarget === undefined) throw new Error('回收站记录写入失败')
  await fs.writeText(sidecarTarget, JSON.stringify({ name, originalPath: canonical, trashedAt: stamp }))
}

/**
 * Restore one trashed skill to its original location.
 * @param fs - fs service face.
 * @param shell - shell service face.
 * @param roots - managed roots.
 * @param name - skill name.
 * @param trashDir - the trash directory path from the list.
 */
export async function restoreSkill(
  fs: FsLike,
  shell: ShellLike,
  roots: SkillRoots,
  name: string,
  trashDir: string,
): Promise<void> {
  const canonical = await guardInside(fs, roots.trash, trashDir, '回收站条目')
  const sidecarRaw = await tryRead(fs, `${canonical}.json`)
  if (sidecarRaw === undefined) throw new Error('回收站记录缺失，无法恢复')
  let originalPath = ''
  try {
    const meta = JSON.parse(sidecarRaw) as { originalPath?: string }
    originalPath = typeof meta.originalPath === 'string' ? meta.originalPath : ''
  } catch {
    throw new Error('回收站记录损坏，无法恢复')
  }
  if (originalPath === '') throw new Error('回收站记录缺少原始路径，无法恢复')
  const origin = await guardInside(fs, roots.userDsh, originalPath, '技能').catch(async () => {
    return await guardInside(fs, roots.userAgents, originalPath, '技能')
  })
  const parent = origin.slice(0, origin.lastIndexOf('/'))
  const parentTarget = await safeResolve(fs, parent)
  if (parentTarget === undefined) await runShellCommand(shell, `mkdir -p -- ${shellQuote(parent)}`)
  await runShellCommand(shell, `mv -- ${shellQuote(canonical)} ${shellQuote(origin)}`)
  await runShellCommand(shell, `rm -f -- ${shellQuote(`${canonical}.json`)}`)
}

/**
 * Permanently delete one trashed skill (irreversible).
 * @param fs - fs service face.
 * @param shell - shell service face.
 * @param roots - managed roots.
 * @param name - skill name.
 * @param trashDir - the trash directory path from the list.
 */
export async function deleteSkillForever(
  fs: FsLike,
  shell: ShellLike,
  roots: SkillRoots,
  name: string,
  trashDir: string,
): Promise<void> {
  const canonical = await guardInside(fs, roots.trash, trashDir, '回收站条目')
  await runShellCommand(shell, `rm -rf -- ${shellQuote(canonical)}`)
  await runShellCommand(shell, `rm -f -- ${shellQuote(`${canonical}.json`)}`)
}

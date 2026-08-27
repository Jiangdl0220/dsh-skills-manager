/**
 * Standalone test for the skills-manager core logic: scanning, the path
 * guard, and the guarded mutations. Runs against a throwaway directory tree
 * with fake fs/shell faces (real filesystem underneath).
 *
 * Usage: node test/core.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, realpathSync, rmSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'

// ── fake service faces over the real filesystem ────────────────────────────
const ROOT_TMP = join(tmpdir(), `skm-test-${Date.now()}`)
mkdirSync(join(ROOT_TMP, '.dsh', 'skills'), { recursive: true })
mkdirSync(join(ROOT_TMP, '.agents', 'skills'), { recursive: true })
const ROOT = realpathSync(ROOT_TMP)

const fs = {
  async resolve(path) {
    const p = path.startsWith('/') || path.startsWith(ROOT) ? path : join(ROOT, path)
    const parent = realpathSync(join(p, '..')) // parent must exist; file may not yet
    const displayPath = join(parent, p.slice(p.lastIndexOf('/') + 1))
    return { targetKey: displayPath, displayPath }
  },
  contains(parent, child) {
    return child.displayPath === parent.displayPath || child.displayPath.startsWith(parent.displayPath + sep)
  },
  async stat(target) {
    try {
      const s = statSync(target.displayPath)
      return { type: s.isDirectory() ? 'directory' : s.isFile() ? 'file' : 'other' }
    } catch {
      return undefined
    }
  },
  async listDir(target) {
    return readdirSync(target.displayPath, { withFileTypes: true }).map((e) => {
      const p = join(target.displayPath, e.name)
      return { name: e.name, type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other', target: { targetKey: p, displayPath: p } }
    })
  },
  async readText(target) {
    return readFileSync(target.displayPath, 'utf8')
  },
  async writeText(target, content) {
    writeFileSync(target.displayPath, content, 'utf8')
  },
}

const shell = {
  resolve(request) { return request },
  async run(spec) {
    try {
      const out = execFileSync('bash', ['-c', spec.command], { encoding: 'utf8' })
      return { exitCode: 0, stdout: out, stderr: '' }
    } catch (error) {
      return { exitCode: error.status ?? 1, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') }
    }
  },
}

const skillsCatalog = {
  async list() {
    return [
      {
        name: 'zz-test-skill',
        description: 'catalog description',
        whenToUse: 'when testing',
        invocation: { modelInvocable: true },
        source: 'user-dsh',
        provider: 'filesystem',
        resourceBase: { kind: 'directory', path: join(ROOT, '.dsh', 'skills', 'zz-test-skill') },
      },
      {
        name: 'builtin-example',
        description: 'a built-in skill',
        invocation: { modelInvocable: true },
        source: 'bundled',
        provider: 'filesystem',
        resourceBase: { kind: 'directory', path: '/app/skills/builtin-example' },
      },
    ]
  },
}

// ── module under test ──────────────────────────────────────────────────────
const core = (await import(process.env.CORE_BUNDLE !== undefined
  ? join(process.cwd(), process.env.CORE_BUNDLE)
  : join(import.meta.dirname, '..', 'lib', 'core-test.cjs'))).default

const roots = core.resolveRoots({ dshHome: join(ROOT, '.dsh'), agentsHome: join(ROOT, '.agents') })

// ── helpers ────────────────────────────────────────────────────────────────
let failures = 0
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else { failures++; console.error(`  ✗ ${name} ${detail}`) }
}

const SKILL_MD = (name) => `---\nname: ${name}\ndescription: test description\n---\n\n# ${name}\n\nTest body.\n`

// ── fixture: one dir skill + one loose file skill ──────────────────────────
mkdirSync(join(ROOT, '.dsh', 'skills', 'zz-test-skill'), { recursive: true })
writeFileSync(join(ROOT, '.dsh', 'skills', 'zz-test-skill', 'SKILL.md'), SKILL_MD('zz-test-skill'), 'utf8')
writeFileSync(join(ROOT, '.agents', 'skills', 'zz-loose.md'), SKILL_MD('zz-loose'), 'utf8')

// ── 1. list: enabled + read-only bundled ───────────────────────────────────
console.log('\n[1] list')
let list = await core.listManagedSkills(fs, skillsCatalog, roots)
check('enabled dir skill listed', list.some((s) => s.name === 'zz-test-skill' && s.state === 'enabled' && s.manageable && s.manageFile?.endsWith('/SKILL.md')), JSON.stringify(list.map((s) => s.name)))
check('loose file skill listed', list.some((s) => s.name === 'zz-loose' && s.kind === 'file' && s.manageable), '')
check('disk description preferred over catalog leak', list.find((s) => s.name === 'zz-test-skill')?.description === 'test description', '')
check('bundled is read-only', list.some((s) => s.name === 'builtin-example' && !s.manageable && s.readOnlyReason !== null), '')
const enabledCount = list.filter((s) => s.state === 'enabled').length

// ── 2. disable → hidden from catalog merge (state disabled) ────────────────
console.log('\n[2] disable')
const dirSkill = list.find((s) => s.name === 'zz-test-skill')
await core.setSkillEnabled(fs, shell, roots, 'zz-test-skill', dirSkill.manageFile, false)
check('SKILL.md renamed to .disabled', existsSync(join(ROOT, '.dsh', 'skills', 'zz-test-skill', 'SKILL.md.disabled')) && !existsSync(join(ROOT, '.dsh', 'skills', 'zz-test-skill', 'SKILL.md')), '')
list = await core.listManagedSkills(fs, skillsCatalog, roots)
check('disabled skill listed as disabled', list.some((s) => s.name === 'zz-test-skill' && s.state === 'disabled' && s.manageFileDisabled?.endsWith('SKILL.md.disabled')), JSON.stringify(list.map((s) => `${s.name}:${s.state}`)))

// ── 3. enable → back ───────────────────────────────────────────────────────
console.log('\n[3] enable')
const disabledEntry = list.find((s) => s.name === 'zz-test-skill')
await core.setSkillEnabled(fs, shell, roots, 'zz-test-skill', disabledEntry.manageFileDisabled, true)
check('SKILL.md restored', existsSync(join(ROOT, '.dsh', 'skills', 'zz-test-skill', 'SKILL.md')), '')

// ── 4. trash → sidecar + list ──────────────────────────────────────────────
console.log('\n[4] trash')
list = await core.listManagedSkills(fs, skillsCatalog, roots)
const enabledSkill = list.find((s) => s.name === 'zz-test-skill')
await core.trashSkill(fs, shell, roots, 'zz-test-skill', enabledSkill.path)
check('dir moved into trash', existsSync(join(ROOT, '.dsh', '.skill-trash', 'zz-test-skill-1')) === false && readdirSync(join(ROOT, '.dsh', '.skill-trash')).some((n) => n.startsWith('zz-test-skill-')), readdirSync(join(ROOT, '.dsh', '.skill-trash')).join(','))
list = await core.listManagedSkills(fs, skillsCatalog, roots)
const trashed = list.find((s) => s.name === 'zz-test-skill' && s.state === 'trashed')
check('trashed listed with original path', trashed !== undefined && trashed.originalPath === enabledSkill.path && trashed.trashDir !== null, JSON.stringify(trashed))

// ── 5. restore ─────────────────────────────────────────────────────────────
console.log('\n[5] restore')
await core.restoreSkill(fs, shell, roots, 'zz-test-skill', trashed.trashDir)
check('restored to original location', existsSync(join(ROOT, '.dsh', 'skills', 'zz-test-skill', 'SKILL.md')), '')
list = await core.listManagedSkills(fs, skillsCatalog, roots)
check('listed as enabled again', list.some((s) => s.name === 'zz-test-skill' && s.state === 'enabled'), '')

// ── 6. trash + delete forever ──────────────────────────────────────────────
console.log('\n[6] delete forever')
list = await core.listManagedSkills(fs, skillsCatalog, roots)
const again = list.find((s) => s.name === 'zz-test-skill')
await core.trashSkill(fs, shell, roots, 'zz-test-skill', again.path)
list = await core.listManagedSkills(fs, skillsCatalog, roots)
const trashed2 = list.find((s) => s.name === 'zz-test-skill' && s.state === 'trashed')
await core.deleteSkillForever(fs, shell, roots, 'zz-test-skill', trashed2.trashDir)
check('trash entry removed', !readdirSync(join(ROOT, '.dsh', '.skill-trash')).some((n) => n.startsWith('zz-test-skill-')), '')
list = await core.listManagedSkills(fs, skillsCatalog, roots)
check('gone from list', !list.some((s) => s.name === 'zz-test-skill'), JSON.stringify(list.map((s) => s.name)))

// ── 7. path guard rejects escapes ──────────────────────────────────────────
console.log('\n[7] path guard')
let guardRejected = false
try {
  await core.setSkillEnabled(fs, shell, roots, 'evil', '/etc/hosts', false)
} catch (error) {
  guardRejected = String(error.message).includes('越界') || String(error.message).includes('拒绝')
}
check('guard rejects /etc/hosts', guardRejected, '')
guardRejected = false
try {
  await core.trashSkill(fs, shell, roots, 'evil', join(ROOT, 'outside', '..', 'escape'))
} catch (error) {
  guardRejected = true
}
check('guard rejects escaping path', guardRejected, '')
let restoreRejected = false
try {
  await core.restoreSkill(fs, shell, roots, 'x', '/etc/passwd')
} catch (error) {
  restoreRejected = true
}
check('restore rejects non-trash path', restoreRejected, '')

// ── 8. frontmatter block scalars ────────────────────────────────────────────
console.log('\n[8] frontmatter block scalars')
const literal = `---\nname: browse\nversion: 1.1.0\ndescription: |\n  Fast headless browser for QA testing and site dogfooding. Navigate any URL, interact with\n  elements, verify page state, diff before/after actions.\n---\n# body\n`
const lit = core.parseLightFrontmatter(literal)
// literal | preserves newlines (block-scalar semantics); the UI collapses them
check('literal | gives real text (newlines kept)', lit.description === 'Fast headless browser for QA testing and site dogfooding. Navigate any URL, interact with\nelements, verify page state, diff before/after actions.', JSON.stringify(lit.description))
check('literal does not leak indicator', lit.description !== '|' && !lit.description.startsWith('|'), '')

const folded = `---\nname: agent-reach\ndescription: >\n  Give your AI agent eyes to see the entire internet. Install and configure\n  upstream tools for Twitter/X, Reddit, YouTube, GitHub, Bilibili.\n  Use when: (1) setting up platform access tools for the first time,\n  (2) checking which platforms are available.\n---\n`
const fol = core.parseLightFrontmatter(folded)
check('folded > folds lines to spaces', fol.description === 'Give your AI agent eyes to see the entire internet. Install and configure upstream tools for Twitter/X, Reddit, YouTube, GitHub, Bilibili. Use when: (1) setting up platform access tools for the first time, (2) checking which platforms are available.', JSON.stringify(fol.description))
check('folded does not leak ">"', fol.description !== '>', '')

const chomped = `---\nname: x\ndescription: >-\n  one two\n  three four\n---\n`
check('chomped >- folds', core.parseLightFrontmatter(chomped).description === 'one two three four', '')

const quoted = `---\nname: apple-design\ndescription: "Single line with spaces"\n---\n`
check('quoted single-line', core.parseLightFrontmatter(quoted).description === 'Single line with spaces', '')
check('plain single-line name', core.parseLightFrontmatter('---\nname: anything\ndescription: plain\n---\n').name === 'anything', '')

// ── cleanup ────────────────────────────────────────────────────────────────
rmSync(ROOT, { recursive: true, force: true })
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`}`)
process.exit(failures === 0 ? 0 : 1)

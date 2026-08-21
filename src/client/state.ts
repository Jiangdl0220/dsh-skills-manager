/**
 * Module-level state holder for the skills-manager settings section.
 *
 * The rc.8 settings.section slot contract supplies only the owner share
 * (`close`) — no inject face, no custom locale seat — so the plugin's
 * business handles (the mounted Remote namespace and the bound translate
 * function) live here, set by the plugin body once the Remote mounts and
 * read by the section component at render time. A tiny subscriber set lets
 * the section re-render when the handles become available.
 */
import type { SkillsManagerNamespaceFace } from './remote.ts'
import type { Translate } from './locales.ts'

let remote: SkillsManagerNamespaceFace | undefined
let translate: Translate | undefined
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      /* ignore per-listener failures */
    }
  }
}

/** Publish the mounted handles (plugin body, after the Remote mounts). */
export function mountState(face: SkillsManagerNamespaceFace, t: Translate): void {
  remote = face
  translate = t
  emit()
}

/** Drop the handles (plugin teardown). */
export function clearState(): void {
  remote = undefined
  translate = undefined
  emit()
}

/** Subscribe to handle changes; returns the unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The mounted Remote namespace, or undefined before it mounts. */
export function getRemote(): SkillsManagerNamespaceFace | undefined {
  return remote
}

/** The bound translate function (never undefined after apply runs). */
export function getTranslate(): Translate | undefined {
  return translate
}

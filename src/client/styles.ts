/**
 * The skills-manager stylesheet, hand-written as a template string and
 * injected once by the plugin body: the web server serves exactly one file
 * per client plugin, so no separate CSS artifact may exist. Colors come
 * from the shared `--dsw-alias-*` design platform (with `color-mix` tints);
 * class names carry the `dsh_skm_` prefix to stay unique in the assembled
 * shell.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-skills-manager-style'

/** The injected stylesheet text. */
export const cssText = `
.dsh_skm_root {
  font-family: inherit;
  color: var(--dsw-alias-label-primary);
}
.dsh_skm_intro {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
  line-height: 1.7;
  margin-bottom: 14px;
  max-width: 640px;
}
.dsh_skm_toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.dsh_skm_count {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
  letter-spacing: 0.02em;
  flex: none;
}
.dsh_skm_search {
  flex: 1;
  min-width: 0;
  max-width: 320px;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  color: inherit;
  border-radius: 7px;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease;
}
.dsh_skm_search:focus {
  border-color: var(--dsw-alias-label-tertiary);
}
.dsh_skm_btn {
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  color: inherit;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;
  flex: none;
}
.dsh_skm_btn:hover {
  border-color: var(--dsw-alias-label-tertiary);
}
.dsh_skm_btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.dsh_skm_btn_danger {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent);
  color: var(--dsw-alias-state-error-primary);
}
.dsh_skm_btn_danger:hover {
  border-color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
}
.dsh_skm_btn_warn {
  border-color: color-mix(in srgb, #e8a25a 55%, transparent);
  color: #e8a25a;
}
.dsh_skm_btn_warn:hover {
  border-color: #e8a25a;
  background: color-mix(in srgb, #e8a25a 8%, transparent);
}
.dsh_skm_list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dsh_skm_item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 9px 12px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2)) 50%, transparent);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.dsh_skm_item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-label-tertiary);
}
.dsh_skm_item_disabled {
  opacity: 0.72;
}
.dsh_skm_item_body {
  flex: 1;
  min-width: 0;
}
.dsh_skm_item_title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dsh_skm_item_name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_skm_item_desc {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
  letter-spacing: 0.01em;
}
.dsh_skm_item_meta {
  font-size: 10.5px;
  color: var(--dsw-alias-label-dimmed);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.dsh_skm_item_actions {
  display: flex;
  gap: 6px;
  flex: none;
  align-items: center;
}
.dsh_skm_badge {
  flex: none;
  font-size: 10px;
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
}
.dsh_skm_badge_enabled {
  color: #4cd07d;
  border: 1px solid color-mix(in srgb, #4cd07d 45%, transparent);
}
.dsh_skm_badge_disabled {
  color: var(--dsw-alias-label-tertiary);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-tertiary) 45%, transparent);
}
.dsh_skm_badge_trashed {
  color: #e8a25a;
  border: 1px solid color-mix(in srgb, #e8a25a 45%, transparent);
}
.dsh_skm_badge_readonly {
  color: var(--dsw-alias-label-dimmed);
  border: 1px solid var(--dsw-alias-border-l2);
}
.dsh_skm_empty {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  padding: 14px 4px;
  line-height: 1.7;
}
.dsh_skm_error {
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  padding: 8px 4px;
}
.dsh_skm_confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2)) 60%, transparent);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 8px;
  font-size: 12px;
}
.dsh_skm_confirm_text {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
}
`

/**
 * Inject the stylesheet once (stable id; HMR-safe).
 */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}

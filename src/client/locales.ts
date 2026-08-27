/**
 * `skills-manager` locale namespace: settings page copy.
 * Chinese is the product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '技能管理',
  'intro': '管理已安装的技能：停用后技能会从 \"/\" 列表隐藏但文件保留，可随时启用；删除会移入回收站，可恢复。',
  'count': '共 {n} 个技能',
  'refresh': '刷新',
  'loading': '加载中…',
  'search': '搜索技能…',
  'searchEmpty': '没有匹配「{q}」的技能',
  'empty': '还没有安装任何用户技能。',
  'enabled': '已启用',
  'disabled': '已停用',
  'trashed': '已删除',
  'builtin': '内置',
  'sourceUser': '用户',
  'sourceTrash': '回收站',
  'enable': '启用',
  'disable': '停用',
  'disableConfirm': '停用「{name}」？技能将从 \"/\" 列表隐藏，文件保留。',
  'disableConfirmTitle': '确认停用',
  'delete': '删除',
  'deleteConfirm': '把「{name}」移入回收站？可随时恢复。',
  'deleteConfirmTitle': '确认删除',
  'restore': '恢复',
  'restoreConfirm': '把「{name}」恢复到原位置？',
  'deleteForever': '彻底删除',
  'deleteForeverConfirm': '彻底删除「{name}」？此操作不可恢复！',
  'cancel': '取消',
  'confirm': '确认',
  'busy': '处理中…',
  'readOnly': '只读',
  'path': '位置',
  'source': '来源',
  'state': '状态',
  'actions': '操作',
  'actionError': '操作失败',
  'loadFailed': '加载失败',
  'manageable': '可管理',
  'notManageable': '只读',
  'prevPage': '上一页',
  'nextPage': '下一页',
  'pageOf': '第 {a} / {b} 页',
  'perPage': '{n} 条/页',
  'showAll': '一页全部',
  'noDescription': '暂无描述',
}

/** English dictionary mirroring the Chinese keys. */
export const en: Record<string, string> = {
  'nav': 'Skills',
  'intro': 'Manage installed skills: disabling hides a skill from the \"/\" picker while keeping its files (re-enable anytime); deleting moves it to a restorable trash.',
  'count': '{n} skills',
  'refresh': 'Refresh',
  'loading': 'Loading…',
  'search': 'Search skills…',
  'searchEmpty': 'No skills match “{q}”',
  'empty': 'No user skills installed yet.',
  'enabled': 'Enabled',
  'disabled': 'Disabled',
  'trashed': 'Trashed',
  'builtin': 'Built-in',
  'sourceUser': 'User',
  'sourceTrash': 'Trash',
  'enable': 'Enable',
  'disable': 'Disable',
  'disableConfirm': 'Disable “{name}”? It will disappear from the \"/\" picker; files are kept.',
  'disableConfirmTitle': 'Confirm disable',
  'delete': 'Delete',
  'deleteConfirm': 'Move “{name}” to the trash? You can restore it later.',
  'deleteConfirmTitle': 'Confirm delete',
  'restore': 'Restore',
  'restoreConfirm': 'Restore “{name}” to its original location?',
  'deleteForever': 'Delete forever',
  'deleteForeverConfirm': 'Permanently delete “{name}”? This cannot be undone!',
  'cancel': 'Cancel',
  'confirm': 'Confirm',
  'busy': 'Working…',
  'readOnly': 'Read-only',
  'path': 'Path',
  'source': 'Source',
  'state': 'State',
  'actions': 'Actions',
  'actionError': 'Action failed',
  'loadFailed': 'Failed to load',
  'manageable': 'Managed',
  'notManageable': 'Read-only',
  'prevPage': 'Prev',
  'nextPage': 'Next',
  'pageOf': 'Page {a} of {b}',
  'perPage': '{n} / page',
  'showAll': 'Show all',
  'noDescription': 'No description',
}

/** Locale namespace id. */
export const NS = 'skills-manager'

/** A translation function bound to the active locale. */
export type Translate = (key: string, params?: Record<string, string>) => string

/** Format a bound string with `{param}` placeholders. */
export function fmt(template: string, params?: Record<string, string>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => (key in params ? params[key] : `{${key}}`))
}

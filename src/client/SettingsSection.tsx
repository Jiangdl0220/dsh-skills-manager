/**
 * The skills-manager settings section: the full installed-skill list (enabled,
 * disabled, trashed) with enable/disable/trash/restore/delete-forever actions
 * behind two-step confirmations, plus a search filter. Registered into
 * `settings.section` — a fresh additive section next to the shipped entries.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SkillEntry } from '../contract.ts'
import type { SkillsManagerNamespaceFace } from './remote.ts'
import type { Translate } from './locales.ts'
import { getRemote, getTranslate, subscribe } from './state.ts'

/** One pending two-step confirmation. */
type Confirm = { kind: 'disable' | 'trash' | 'restore' | 'deleteForever'; entry: SkillEntry } | null

const stateKey = (state: string): string => {
  if (state === 'enabled') return 'enabled'
  if (state === 'disabled') return 'disabled'
  return 'trashed'
}

/** Number of skill rows per page. */
const PAGE_SIZE = 20

/** The installed-skill list with management actions. */
export function SettingsSection(_props: PropsRuntime<'settings.section'>): ReactElement {
  const [, tick] = useState(0)
  useEffect(() => subscribe(() => tick((n) => n + 1)), [])
  const t: Translate = getTranslate() ?? ((key) => key)
  const [list, setList] = useState<{ items: SkillEntry[] | null; error: string | null; loading: boolean }>({
    items: null,
    error: null,
    loading: false,
  })
  const [query, setQuery] = useState('')
  const [pageIdx, setPageIdx] = useState(0)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadList = (): void => {
    setList({ items: null, error: null, loading: true })
    const remote = getRemote()
    if (remote === undefined) {
      setList({ items: null, error: 'Remote unavailable', loading: false })
      return
    }
    remote.list().then((result) => {
      if (result.ok) setList({ items: result.value.skills, error: null, loading: false })
      else setList({ items: null, error: result.error.message, loading: false })
    }).catch((error: unknown) => {
      setList({ items: null, error: String(error instanceof Error ? error.message : error), loading: false })
    })
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAction = (action: (remote: SkillsManagerNamespaceFace) => Promise<{ ok: boolean; error?: { message: string } }>): void => {
    setBusy(true)
    setActionError(null)
    const remote = getRemote()
    if (remote === undefined) {
      setBusy(false)
      setActionError('Remote unavailable')
      return
    }
    action(remote).then((result) => {
      setBusy(false)
      if (result.ok) {
        setConfirm(null)
        loadList()
      } else {
        setActionError(result.error?.message ?? 'unknown error')
      }
    }).catch((error: unknown) => {
      setBusy(false)
      setActionError(String(error instanceof Error ? error.message : error))
    })
  }

  const items = list.items ?? []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return items
    return items.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.sourceLabel.toLowerCase().includes(q),
    )
  }, [items, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(pageIdx, totalPages - 1)
  const pageStart = safePage * PAGE_SIZE
  const visible = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart],
  )

  const rows: ReactElement[] = []
  const itemRows: ReactElement[] = []

  rows.push(
    <div className="dsh_skm_toolbar" key="toolbar">
      <span className="dsh_skm_count">{t('count', { n: String(items.length) })}</span>
      <input
        className="dsh_skm_search"
        placeholder={t('search')}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setPageIdx(0); setConfirm(null) }}
      />
      <button className="dsh_skm_btn" onClick={loadList} disabled={list.loading}>
        {list.loading ? t('loading') : t('refresh')}
      </button>
    </div>,
  )
  if (actionError !== null) rows.push(<div className="dsh_skm_error" key="actionError">⚠ {actionError}</div>)
  if (list.error !== null) rows.push(<div className="dsh_skm_error" key="listError">⚠ {t('loadFailed')}: {list.error}</div>)
  if (list.loading && items.length === 0) rows.push(<div className="dsh_skm_empty" key="loading">{t('loading')}</div>)
  if (!list.loading && list.error === null && filtered.length === 0) {
    rows.push(
      <div className="dsh_skm_empty" key="empty">
        {query.trim() !== '' ? t('searchEmpty', { q: query.trim() }) : t('empty')}
      </div>,
    )
  }

  for (const item of visible) {
    const key = `${item.state}:${item.path ?? item.trashDir ?? item.name}`
    const badge = (
      <span className={`dsh_skm_badge dsh_skm_badge_${stateKey(item.state)}`} key="badge">
        {t(stateKey(item.state))}
      </span>
    )
    const actions: ReactElement[] = []
    if (item.manageable && item.state === 'enabled' && item.manageFile !== null) {
      actions.push(
        <button
          className="dsh_skm_btn dsh_skm_btn_warn" key="disable" disabled={busy}
          onClick={(event) => { event.stopPropagation(); setActionError(null); setConfirm({ kind: 'disable', entry: item }) }}
        >
          {t('disable')}
        </button>,
      )
    }
    if (item.manageable && item.state === 'disabled' && item.manageFileDisabled !== null) {
      actions.push(
        <button
          className="dsh_skm_btn" key="enable" disabled={busy}
          onClick={(event) => {
            event.stopPropagation()
            setActionError(null)
            runAction((remote) => remote.setEnabled({ name: item.name, path: item.manageFileDisabled ?? '', enabled: true }))
          }}
        >
          {t('enable')}
        </button>,
      )
    }
    if (item.manageable && item.state === 'enabled' && item.path !== null) {
      actions.push(
        <button
          className="dsh_skm_btn dsh_skm_btn_danger" key="trash" disabled={busy}
          onClick={(event) => { event.stopPropagation(); setActionError(null); setConfirm({ kind: 'trash', entry: item }) }}
        >
          {t('delete')}
        </button>,
      )
    }
    if (item.manageable && item.state === 'trashed' && item.trashDir !== null) {
      actions.push(
        <button
          className="dsh_skm_btn" key="restore" disabled={busy}
          onClick={(event) => { event.stopPropagation(); setActionError(null); setConfirm({ kind: 'restore', entry: item }) }}
        >
          {t('restore')}
        </button>,
        <button
          className="dsh_skm_btn dsh_skm_btn_danger" key="deleteForever" disabled={busy}
          onClick={(event) => { event.stopPropagation(); setActionError(null); setConfirm({ kind: 'deleteForever', entry: item }) }}
        >
          {t('deleteForever')}
        </button>,
      )
    }
    if (!item.manageable) {
      actions.push(<span className="dsh_skm_badge dsh_skm_badge_readonly" key="ro">{t('readOnly')}</span>)
    }

    const metaParts = [item.sourceLabel, item.path ?? item.trashDir ?? ''].filter((part) => part !== '')
    const description = item.description !== '' ? item.description : (item.readOnlyReason ?? '')

    itemRows.push(
      <div className={`dsh_skm_item${item.state === 'disabled' ? ' dsh_skm_item_disabled' : ''}`} key={key}>
        <div className="dsh_skm_item_body">
          <div className="dsh_skm_item_title">
            <span className="dsh_skm_item_name">{item.name}</span>
            {badge}
          </div>
          {description !== '' ? <div className="dsh_skm_item_desc">{description}</div> : null}
          {metaParts.length > 0 ? <div className="dsh_skm_item_meta">{metaParts.join(' · ')}</div> : null}
        </div>
        <div className="dsh_skm_item_actions">{actions}</div>
      </div>,
    )

    if (confirm !== null && confirm.entry.path === item.path && confirm.entry.state === item.state) {
      const label = confirm.kind === 'disable' ? t('disableConfirm', { name: item.name })
        : confirm.kind === 'trash' ? t('deleteConfirm', { name: item.name })
        : confirm.kind === 'restore' ? t('restoreConfirm', { name: item.name })
        : t('deleteForeverConfirm', { name: item.name })
      itemRows.push(
        <div className="dsh_skm_confirm" key={`${key}:confirm`}>
          <span className="dsh_skm_confirm_text">{label}</span>
          <button
            className="dsh_skm_btn dsh_skm_btn_danger" disabled={busy}
            onClick={() => {
              const entry = confirm.entry
              const skillName = entry.name
              const manageFile = entry.manageFile
              const containerPath = entry.path
              const trashDir = entry.trashDir
              if (confirm.kind === 'disable' && manageFile !== null) {
                runAction((remote) => remote.setEnabled({ name: skillName, path: manageFile, enabled: false }))
              } else if (confirm.kind === 'trash' && containerPath !== null) {
                runAction((remote) => remote.trash({ name: skillName, path: containerPath }))
              } else if (confirm.kind === 'restore' && trashDir !== null) {
                runAction((remote) => remote.restore({ name: skillName, trashDir }))
              } else if (confirm.kind === 'deleteForever' && trashDir !== null) {
                runAction((remote) => remote.deleteForever({ name: skillName, trashDir }))
              }
            }}
          >
            {busy ? t('busy') : t('confirm')}
          </button>
          <button className="dsh_skm_btn" disabled={busy} onClick={() => setConfirm(null)}>{t('cancel')}</button>
        </div>,
      )
    }
  }

  if (itemRows.length > 0) {
    rows.push(<div className="dsh_skm_list" key="list">{itemRows}</div>)
    if (totalPages > 1) {
      rows.push(
        <div className="dsh_skm_pager" key="pager">
          <button
            className="dsh_skm_btn"
            disabled={busy || safePage === 0}
            onClick={() => { setConfirm(null); setPageIdx(safePage - 1) }}
          >
            {t('prevPage')}
          </button>
          <span className="dsh_skm_pager_info">{t('pageOf', { a: String(safePage + 1), b: String(totalPages) })}</span>
          <button
            className="dsh_skm_btn"
            disabled={busy || safePage >= totalPages - 1}
            onClick={() => { setConfirm(null); setPageIdx(safePage + 1) }}
          >
            {t('nextPage')}
          </button>
        </div>,
      )
    }
  }

  return <div className="dsh_skm_root">{rows}</div>
}

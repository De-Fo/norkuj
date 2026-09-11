import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/lang'
import { DEFAULT_FILTERS } from '../lib/types'
import { requiresMinPrice } from '../lib/types'
import type { SearchFilters } from '../lib/types'
import type { User } from '@supabase/supabase-js'
import { mapError } from '../lib/errors'
import { ListingCard } from '../components/ListingCard'
import { FilterPanel } from '../components/FilterPanel'
import { pushSupported, enablePush, disablePush, isPushActive } from '../lib/push'

type WatchCat = {
  id: string
  user_id: string
  name: string
  filters: SearchFilters
  push_enabled: boolean
  created_at: string
}

const MAX_WATCHCATS = 3
const PREVIEW_COUNT = 4

function matches(f: SearchFilters, l: any): boolean {
  if (f.minPrice > 0 && (l.price_total_czk ?? 0) < f.minPrice) return false
  if (f.maxPrice > 0 && (l.price_total_czk ?? 0) > f.maxPrice) return false
  if (f.minArea > 0 && (l.area_sqm ?? 0) < f.minArea) return false
  if (f.propertyTypes.length > 0 && !f.propertyTypes.includes(l.property_type)) return false
  if (f.furnished && !l.furnished) return false
  if (f.petsAllowed && !l.pets_allowed) return false
  if (f.parking && !l.parking) return false
  if (f.balcony && !l.balcony) return false
  if (f.districts.length > 0 && !(l.address_district || '').split(',').map((s: string) => s.trim()).some((d: string) => f.districts.includes(d))) return false
  return true
}

// Short human-readable summary of a saved filter set.
function filterSummary(f: SearchFilters): string {
  const parts: string[] = []
  if (f.districts.length) parts.push(f.districts.join(', '))
  if (f.propertyTypes.length) parts.push(f.propertyTypes.join(', '))
  if (f.maxPrice > 0) parts.push(`do ${f.maxPrice.toLocaleString()} Kč`)
  if (f.minPrice > 0) parts.push(`od ${f.minPrice.toLocaleString()} Kč`)
  if (f.minArea > 0) parts.push(`${f.minArea}+ m²`)
  const bools: string[] = []
  if (f.furnished) bools.push('zařízený')
  if (f.petsAllowed) bools.push('zvířata OK')
  if (f.parking) bools.push('parkování')
  if (f.balcony) bools.push('balkón')
  if (bools.length) parts.push(bools.join(' · '))
  return parts.length ? parts.join(' · ') : 'Všechny inzeráty'
}

function makeSeenStore() {
  const key = (watchCatId: string) => `wc_seen_${watchCatId}`
  return {
    get: (watchCatId: string): Set<string> => {
      try {
        const raw = localStorage.getItem(key(watchCatId))
        return new Set(raw ? JSON.parse(raw) : [])
      } catch { return new Set() }
    },
    set: (watchCatId: string, ids: Set<string>) => {
      try { localStorage.setItem(key(watchCatId), JSON.stringify([...ids])) } catch {}
    },
  }
}

export function WatchCatPage({ user, currentFilters, openComposer, onComposerConsumed, onGoHome, onApply, onListingClick, isMobile, isAdmin }: {
  user: User
  currentFilters: SearchFilters
  openComposer?: boolean
  onComposerConsumed?: () => void
  onGoHome: () => void
  onApply: (f: SearchFilters) => void   // navigate to search and apply the saved filter set
  onListingClick: (id: string) => void
  isMobile?: boolean
  isAdmin?: boolean
}) {
  const { t } = useLang()
  const [cats, setCats] = useState<WatchCat[]>([])
  const [base, setBase] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Create / edit composer state ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDraft, setEditDraft] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [showCreate, setShowCreate] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draft, setDraft] = useState<SearchFilters>(DEFAULT_FILTERS)

  // ── Push state ──
  const [pushBusy, setPushBusy] = useState(false)
  const pushCapable = pushSupported()
  // devicePushOn: does THIS browser have a push subscription? (per-device truth).
  // Separated from the per-cat watch_cats.push_enabled flag so a toggle only reads
  // "on" when both this device is subscribed AND the cat's flag is set.
  const [devicePushOn, setDevicePushOn] = useState(false)

  // Transient per-card feedback timers (reuse the shareToast timer pattern).
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [cardFeedback, setCardFeedback] = useState<{ id: string; kind: 'ok' | 'err'; text: string } | null>(null)

  // Seed device push truth once on mount (browser subscription state).
  // Only read once per page load so it doesn't re-prompt or flash.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const on = await isPushActive().catch(() => false)
      if (alive) setDevicePushOn(Boolean(on))
    })()
    return () => { alive = false }
  }, [])

  const seen = useMemo(() => makeSeenStore(), [])

  const flashFeedback = (id: string, kind: 'ok' | 'err', text: string) => {
    setCardFeedback({ id, kind, text })
    clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setCardFeedback(null), 2500)
  }

  const loadCats = useCallback(async () => {
    const { data, error } = await supabase.from('watch_cats').select('*').order('created_at', { ascending: true })
    if (error) { if (import.meta.env.DEV) console.error('[watchcats]', error); setCats([]); return }
    setCats(data ?? [])
  }, [])

  // Fetch all published listings once, reuse for every watch-cat preview.
  // Robust: never leave the page stuck on loading — clear it even if the RPC
  // throws, and time out so a hung request can't blank the screen.
  useEffect(() => {
    let alive = true
    const finish = () => { if (alive) setLoading(false) }
    const timer = setTimeout(finish, 8000) // backstop — never hang indefinitely
    ;(async () => {
      try {
        const { data, error } = await (supabase.rpc as any)('get_published_listings_with_coords')
        if (error) { if (import.meta.env.DEV) console.error('[watchcats base]', error) }
        if (alive) setBase(data ?? [])
      } catch (e) {
        if (import.meta.env.DEV) console.error('[watchcats base]', e)
      } finally {
        clearTimeout(timer)
        finish()
      }
    })()
    loadCats()
    return () => { alive = false; clearTimeout(timer) }
  }, [loadCats])

  // Clear the feedback timer on unmount (shareToast-style cleanup).
  useEffect(() => () => clearTimeout(feedbackTimer.current), [])

  // Live count for the inline FilterPanel while creating/editing.
  const draftCount = base.filter((l) => matches(draft, l)).length
  const editCount = base.filter((l) => matches(editDraft, l)).length

  // When arriving from "save current filters" in the search, open the composer prefilled.
  useEffect(() => {
    if (openComposer) {
      setShowCreate(true)
      setDraft(currentFilters)
      onComposerConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openComposer])

  const createFromCurrent = async () => {
    const name = draftName.trim()
    if (!name) return
    if (!isAdmin && requiresMinPrice(draft, isAdmin ?? false)) return   // too-wide range → needs a floor
    if (!isAdmin && !draft.maxPrice) return                             // price cap required (admins: optional)
    setSaving(true)
    const { error } = await (supabase.from('watch_cats') as any).insert({
      user_id: user.id,
      name,
      filters: draft,
    })
    setSaving(false)
    if (error) { alert(mapError(error, t)); return }
    setShowCreate(false)
    setDraftName('')
    setDraft(DEFAULT_FILTERS)
    await loadCats()
  }

  const saveEdit = async () => {
    const name = editName.trim()
    if (!name || !editingId) return
    if (!isAdmin && requiresMinPrice(editDraft, isAdmin ?? false)) return
    if (!isAdmin && !editDraft.maxPrice) return   // price cap required for a watch-cat
    setSaving(true)
    const { error } = await (supabase.from('watch_cats') as any).update({ name, filters: editDraft }).eq('id', editingId)
    setSaving(false)
    if (error) { alert(mapError(error, t)); return }
    setEditingId(null)
    await loadCats()
  }

  const remove = async (id: string) => {
    if (!confirm(t('watchcats_delete_confirm'))) return
    const { error } = await (supabase.from('watch_cats') as any).delete().eq('id', id)
    if (error) { alert(mapError(error, t)); return }
    await loadCats()
  }

  // Enable push for a cat on THIS device (subscription first, then the per-cat flag).
  const enableCatPush = async (wc: WatchCat): Promise<boolean> => {
    const on = await isPushActive()
    const sub = on ? true : await enablePush()
    if (!sub) return false
    const { error } = await (supabase.from('watch_cats') as any).update({ push_enabled: true }).eq('id', wc.id)
    if (error) { if (import.meta.env.DEV) console.error('[push] turn on', error); return false }
    setDevicePushOn(true)
    return true
  }

  // Enables when off OR this device isn't subscribed; otherwise disables. Uses the same
  // combined state the button renders, so a fresh device's first click enables, not off.
  const toggleCatPush = async (wc: WatchCat) => {
    if (!pushCapable || pushBusy) return
    setPushBusy(true)
    try {
      const isOn = wc.push_enabled && devicePushOn
      if (!isOn) {
        const ok = await enableCatPush(wc)
        if (!ok) {
          flashFeedback(wc.id, 'err', t('watchcats_push_failed'))
          return
        }
        flashFeedback(wc.id, 'ok', t('watchcats_push_on_feedback'))
      } else {
        const otherOn = cats.some((c) => c.id !== wc.id && c.push_enabled)
        const { error } = await supabase.from('watch_cats').update({ push_enabled: false }).eq('id', wc.id)
        if (error) { if (import.meta.env.DEV) console.error('[push] off', error) }
        if (!otherOn) await disablePush().catch(() => {})   // last cat off → drop browser sub
        setDevicePushOn(!otherOn ? false : devicePushOn)
        flashFeedback(wc.id, 'ok', t('watchcats_push_off_feedback'))
      }
      await loadCats()
    } catch (e) {
      // Brave/ad-blockers block registration → show the settings hint, not a raw error.
      const msg = (e as Error)?.message || ''
      const isBrave = /push service error|registration failed/i.test(msg)
      flashFeedback(wc.id, 'err', isBrave ? t('watchcats_push_brave_setting') : (msg || t('watchcats_push_failed')))
      await loadCats().catch(() => {})
    } finally {
      setPushBusy(false)
    }
  }

  const matching = (wc: WatchCat): any[] => {
    const f = { ...DEFAULT_FILTERS, ...wc.filters }
    return base.filter((l) => matches(f, l))
  }

  const markAllSeen = (wc: WatchCat) => {
    const ids = seen.get(wc.id)
    matching(wc).forEach((l) => ids.add(l.id))
    seen.set(wc.id, ids)
    flashFeedback(wc.id, 'ok', t('watchcats_mark_read_done')) // visible "marked" confirmation
  }

  // Auto-prompt: if the user has push-enabled watch-cats but THIS device hasn't
  // granted push yet, offer to enable it (on an explicit button, not auto-invoke).
  const pendingPush = pushCapable && !devicePushOn && cats.some((c) => c.push_enabled)

  if (loading) {
    return <div style={{ flex: 1, overflow: 'auto', padding: 16 }}><p style={{ color: 'var(--c-muted)', fontSize: 13 }}>{t('loading')}</p></div>
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--c-text)' }}>
            {t('watchcats_title')}
          </h2>
          {cats.length > 0 && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--c-faint)' }}>
            {cats.length}/{MAX_WATCHCATS} · {t('watchcats_limit')}
          </p>}
        </div>
        <button onClick={onGoHome} style={{ padding: '6px 14px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 12, cursor: 'pointer' }}>
          {t('back_search')}
        </button>
      </header>

      {cats.length === 0 && !showCreate && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>🐈</div>
          <p style={{ color: 'var(--c-muted)', fontSize: 14, maxWidth: 400, margin: 0 }}>{t('watchcats_empty')}</p>
          <button onClick={() => { setShowCreate(true); setDraft(currentFilters) }} style={{
            marginTop: 4, padding: '10px 18px', borderRadius: 10, border: 'none',
            background: 'var(--c-accent, #2563eb)', color: '#fff', fontSize: 13, cursor: 'pointer',
          }}>
            {t('watchcats_new')}
          </button>
        </div>
      )}

      {/* Returners with flagged cats but no sub on this device get an enable button. */}
      {pendingPush && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 12px',
          border: '1px solid var(--c-border)', borderRadius: 10, background: 'var(--c-surface)' }}>
          <span style={{ fontSize: 13, color: 'var(--c-text)', flex: 1 }}>{t('watchcats_push_banner')}</span>
          <button onClick={async () => {
            const enabled = cats.find((c) => c.push_enabled)
            if (enabled) { setPushBusy(true); const ok = await enableCatPush(enabled); setPushBusy(false); if (ok) flashFeedback(enabled.id, 'ok', t('watchcats_push_on_feedback')) }
          }}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--c-accent, #2563eb)', color: '#fff', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('watchcats_push_banner_btn')}
          </button>
        </div>
      )}

      {cats.map((wc) => {
        const m = matching(wc)
        const unknown = m.filter((l) => !seen.get(wc.id).has(l.id)).length
        const isEditing = editingId === wc.id
        return (
          <div key={wc.id} style={{ border: '1px solid var(--c-border)', borderRadius: 14, padding: 14, marginBottom: 12, background: 'var(--c-surface)' }}>

            {/* ── Card header: name (left) · push toggle + actions (right) ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🐱 {wc.name}
                  {unknown > 0 && <span style={{
                    background: '#16a34a', color: '#fff', borderRadius: 999, fontSize: 11,
                    padding: '1px 8px', lineHeight: '18px', flexShrink: 0,
                  }}>{unknown} {t('watchcats_new_count')}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>{filterSummary({ ...DEFAULT_FILTERS, ...wc.filters })}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {/* Push toggle — on desktop sits inline with the actions; on mobile
                    it drops to its own row below (see cardFooter) so it stays readable. */}
                {!isMobile && (
                  <>
                    {pushCapable ? (
                      <button onClick={() => toggleCatPush(wc)} disabled={pushBusy}
                        role="switch" aria-checked={wc.push_enabled && devicePushOn} aria-label={t('watchcats_push_label')}
                        title={t('watchcats_push_label')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 6px 0 12px',
                          borderRadius: 999, cursor: pushBusy ? 'wait' : 'pointer',
                          border: '1px solid var(--c-border)', background: 'transparent', flexShrink: 0,
                          opacity: pushBusy ? 0.6 : 1,
                        }}>
                        <span style={{ fontSize: 12, color: 'var(--c-muted)', whiteSpace: 'nowrap' }}>
                          {wc.push_enabled && devicePushOn ? t('push_on') : t('push_off')}
                        </span>
                        <span style={{ width: 30, height: 18, borderRadius: 999, position: 'relative', flexShrink: 0,
                          background: wc.push_enabled && devicePushOn ? '#2563eb' : 'var(--c-border-md)', transition: 'background 0.15s' }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2,
                            transition: 'left 0.15s', left: wc.push_enabled && devicePushOn ? 14 : 2, boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
                        </span>
                      </button>
                    ) : (
                      <span title={t('watchcats_push_unavailable')} style={{ fontSize: 10, color: 'var(--c-faint)', whiteSpace: 'nowrap' }}>🔕</span>
                    )}
                  </>
                )}

                <button onClick={() => { setEditingId(wc.id); setEditName(wc.name); setEditDraft({ ...DEFAULT_FILTERS, ...wc.filters }) }}
                  title={t('watchcats_edit')} style={{ height: 32, padding: '0 10px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                <button onClick={() => remove(wc.id)} title={t('watchcats_delete')} style={{ height: 32, padding: '0 10px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 12 }}>🗑</button>
              </div>
            </div>

            {/* Mobile push toggle — own row below the name/edit/trash row, full-width so it's readable */}
            {isMobile && (
              <div style={{ marginBottom: 8 }}>
                {pushCapable ? (
                  <button onClick={() => toggleCatPush(wc)} disabled={pushBusy}
                    role="switch" aria-checked={wc.push_enabled && devicePushOn} aria-label={t('watchcats_push_label')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 6px 0 14px', width: '100%',
                      borderRadius: 10, cursor: pushBusy ? 'wait' : 'pointer',
                      border: '1px solid var(--c-border)', background: 'var(--c-bg)',
                      opacity: pushBusy ? 0.6 : 1, justifyContent: 'space-between',
                    }}>
                    <span style={{ fontSize: 13, color: 'var(--c-text)', whiteSpace: 'nowrap' }}>
                      {t('watchcats_push_label')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--c-muted)', whiteSpace: 'nowrap' }}>
                        {wc.push_enabled && devicePushOn ? t('push_on') : t('push_off')}
                      </span>
                      <span style={{ width: 34, height: 20, borderRadius: 999, position: 'relative', flexShrink: 0,
                        background: wc.push_enabled && devicePushOn ? '#2563eb' : 'var(--c-border-md)', transition: 'background 0.15s' }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2,
                          transition: 'left 0.15s', left: wc.push_enabled && devicePushOn ? 16 : 2, boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
                      </span>
                    </span>
                  </button>
                ) : (
                  <span title={t('watchcats_push_unavailable')} style={{ fontSize: 10, color: 'var(--c-faint)', whiteSpace: 'nowrap' }}>🔕 {t('watchcats_push_unavailable')}</span>
                )}
              </div>
            )}

            {/* Transient feedback for push toggle / mark-as-read actions */}
            {cardFeedback?.id === wc.id && (
              <div style={{
                marginBottom: 8, padding: '7px 10px', borderRadius: 8, fontSize: 13,
                background: cardFeedback.kind === 'ok' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.10)',
                color: cardFeedback.kind === 'ok' ? 'var(--c-green, #15803d)' : 'var(--c-red, #b91c1c)',
              }}>
                {cardFeedback.text}
              </div>
            )}

            {isEditing ? (
              <div style={{ border: '1px solid var(--c-accent, #2563eb)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                    placeholder={t('watchcats_name_placeholder')}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', fontSize: 13 }} />
                </div>
                <FilterPanel filters={editDraft} onChange={setEditDraft} resultCount={editCount} loading={loading} isMobile={false} requiredMaxPrice={!isAdmin} requiresMin={requiresMinPrice(editDraft, isAdmin ?? false)} minPrice={editDraft.minPrice} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={saveEdit} disabled={saving || !editName.trim() || (!isAdmin && (!editDraft.maxPrice || requiresMinPrice(editDraft, false)))}
                    style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--c-accent, #2563eb)', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: (saving || !editName.trim() || (!isAdmin && (!editDraft.maxPrice || requiresMinPrice(editDraft, false)))) ? 0.6 : 1 }}>
                    {t('watchcats_save')}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer' }}>
                    {t('watchcats_cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {m.length === 0 ? (
                  <p style={{ color: 'var(--c-faint)', fontSize: 13, margin: '4px 0 10px' }}>{t('watchcats_empty_matches')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 0 10px' }}>
                    {m.slice(0, PREVIEW_COUNT).map((l: any) => (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!seen.get(wc.id).has(l.id) && <span style={{ width: 8, height: 8, borderRadius: 999, background: '#16a34a', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <ListingCard listing={l} onClick={() => onListingClick(l.id)} />
                        </div>
                      </div>
                    ))}
                    {m.length > PREVIEW_COUNT && (
                      <button onClick={() => onApply({ ...DEFAULT_FILTERS, ...wc.filters })}
                        style={{ alignSelf: 'center', padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--c-accent, #2563eb)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                        {t('watchcats_see_all')}
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => markAllSeen(wc)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-muted)', fontSize: 12, cursor: 'pointer' }}>
                    {t('watchcats_mark_read')}
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}

      {showCreate && (
        <div style={{ border: '1px solid var(--c-accent, #2563eb)', borderRadius: 14, padding: 12, marginBottom: 12, background: 'var(--c-surface)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)}
              placeholder={t('watchcats_name_placeholder')}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', fontSize: 13 }} />
          </div>
          <FilterPanel filters={draft} onChange={setDraft} resultCount={draftCount} loading={loading} isMobile={false} requiredMaxPrice={!isAdmin} requiresMin={requiresMinPrice(draft, isAdmin ?? false)} minPrice={draft.minPrice} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => createFromCurrent()} disabled={saving || !draftName.trim() || (!isAdmin && (!draft.maxPrice || requiresMinPrice(draft, false)))}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--c-accent, #2563eb)', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: (saving || !draftName.trim() || (!isAdmin && (!draft.maxPrice || requiresMinPrice(draft, false)))) ? 0.6 : 1 }}>
              {t('watchcats_save')}
            </button>
            <button onClick={() => { setShowCreate(false); setDraft(DEFAULT_FILTERS); setDraftName('') }}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer' }}>
              {t('watchcats_cancel')}
            </button>
          </div>
        </div>
      )}

      {cats.length > 0 && cats.length < MAX_WATCHCATS && (
        <button onClick={() => { setShowCreate(true); setDraft(currentFilters) }}
          style={{
            padding: '9px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: '1px dashed var(--c-border)', background: 'transparent', color: 'var(--c-text)',
            marginTop: 4,
          }}>
          {t('watchcats_new')}
        </button>
      )}
    </div>
  )
}
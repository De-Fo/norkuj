import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PROPERTY_TYPE_LABELS, type PropertyType } from '../lib/types'
import { formatPrice, formatDate, getImageUrl } from '../lib/utils'
import { useLang } from '../lib/lang'
import { mapError } from '../lib/errors'

interface AdminListing {
  id: string
  title: string
  description: string
  property_type: string
  price_total_czk: number
  area_sqm: number
  address_street: string
  address_district: string
  address_city: string
  status: string
  created_at: string
  image_paths: string[]
  owner: { display_name: string; phone: string } | null
}

// Map tab key → DB status value
const TAB_STATUS: Record<string, string | null> = {
  pending:   'pending_review',
  published: 'published',
  rejected:  'rejected',
  all:       null,
}

type Tab = 'pending' | 'published' | 'rejected' | 'all'

const STATUS_COLORS: Record<string, string> = {
  pending_review: '#f59e0b',
  published:      '#16a34a',
  rejected:       '#dc2626',
  draft:          '#94a3b8',
  deleted:        '#94a3b8',
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: '_admin_status_pending',
  published:      '_admin_status_published',
  rejected:       '_admin_status_rejected',
  draft:          '_admin_status_draft',
  deleted:        '_admin_status_deleted',
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [listings, setListings] = useState<AdminListing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [selected, setSelected] = useState<AdminListing | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [stats, setStats] = useState({ pending: 0, published: 0, rejected: 0, total: 0 })
  const { t } = useLang()
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const isMobile = window.innerWidth < 768

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error && import.meta.env.DEV) console.error('[admin getUser]', error)
      if (!data.user) { setIsAdmin(false); return }
      supabase.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle()
        .then(({ data: profile, error: pErr }: any) => {
          if (pErr && import.meta.env.DEV) console.error('[admin profile check]', pErr)
          setIsAdmin(profile?.is_admin === true)
        })
    })
  }, [])

  const fetchListings = async () => {
    setLoading(true)

    // Fetch all for stats
    const { data: allData } = await (supabase.from('listings').select('status') as any)

    if (allData) {
      setStats({
        pending:   (allData as any[]).filter((l: any) => l.status === 'pending_review').length,
        published: (allData as any[]).filter((l: any) => l.status === 'published').length,
        rejected:  (allData as any[]).filter((l: any) => l.status === 'rejected').length,
        total:     allData.length,
      })
    }

    // Fetch listings for current tab
    const statusFilter = TAB_STATUS[tab]
    let query = supabase
      .from('listings')
      .select('id,title,description,property_type,price_total_czk,area_sqm,address_street,address_district,address_city,status,created_at,image_paths,owner:profiles(display_name,phone)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      if (import.meta.env.DEV) console.error('Admin fetch error:', error)
      setListings([])
    } else {
      setListings((data ?? []) as unknown as AdminListing[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) fetchListings()
  }, [tab, isAdmin])

  const showMsg = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  const approve = async (id: string) => {
    setActing(true)
    const { data, error } = await (supabase.from('listings') as any)
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id)
      .select()

    if (error || !data || data.length === 0) {
      if (import.meta.env.DEV) console.error('Approve error or no rows affected:', error, data)
      showMsg(error ? mapError(error, t) : (t('_admin_error') + 'Oprávnění zamítnuto — žádný řádek nebyl aktualizován'))
      setActing(false)
      return
    }
    // Fire-and-forget: notify owner
    supabase.functions.invoke('send-listing-email', {
      method: 'POST',
      body: { listingId: id, eventType: 'published' },
    }).catch((e: unknown) => {
      if (import.meta.env.DEV) console.error('[email notify]', e)
    })
    showMsg(t('_admin_msg_published'))
    setSelected(null)
    setActing(false)
    await fetchListings()
  }

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { showMsg(t('_admin_msg_reject_needed')); return }
    setActing(true)
    const { data, error } = await (supabase.from('listings') as any)
      .update({ status: 'rejected', rejection_reason: rejectReason.trim() })
      .eq('id', id)
      .select()

    if (error || !data || data.length === 0) {
      if (import.meta.env.DEV) console.error('Reject error or no rows affected:', error, data)
      showMsg(error ? mapError(error, t) : (t('_admin_error') + 'Oprávnění zamítnuto — žádný řádek nebyl aktualizován'))
      setActing(false)
      return
    }
    // Fire-and-forget: notify owner with rejection reason
    supabase.functions.invoke('send-listing-email', {
      method: 'POST',
      body: { listingId: id, eventType: 'rejected', reason: rejectReason.trim() },
    }).catch((e: unknown) => {
      if (import.meta.env.DEV) console.error('[rejection email]', e)
    })
    showMsg(t('_admin_msg_rejected'))
    setSelected(null)
    setRejectReason('')
    setActing(false)
    await fetchListings()
  }

  const deleteL = async (id: string) => {
    // "Smazat trvale" — hard DELETE, no email, owner already notified by prior step
    if (!confirm(t('_admin_confirm_delete'))) return
    setActing(true)

    // First grab image paths so we can clean up storage
    const { data: listing } = await (supabase.from('listings') as any)
      .select('image_paths')
      .eq('id', id)
      .single()

    if (listing?.image_paths?.length > 0) {
      await supabase.storage.from('listing-images').remove(listing.image_paths).catch(() => {})
    }

    const { error } = await supabase.from('listings').delete().eq('id', id) as any
    if (error) {
      if (import.meta.env.DEV) console.error('Hard delete error:', error)
      showMsg(mapError(error, t))
    } else {
      showMsg(t('_admin_msg_deleted'))
      setSelected(null)
      await fetchListings()
    }
    setActing(false)
  }

  const republishL = async (id: string) => {
    if (!confirm(t('_admin_republish_confirm'))) return
    setActing(true)
    const { data, error } = await (supabase.from('listings') as any)
      .update({ status: 'published', published_at: new Date().toISOString(), rejection_reason: null })
      .eq('id', id)
      .select()
    if (error || !data || data.length === 0) {
      if (import.meta.env.DEV) console.error('Republish error:', error, data)
      showMsg(error ? mapError(error, t) : (t('_admin_error') + 'Oprávnění zamítnuto'))
    } else {
      supabase.functions.invoke('send-listing-email', {
        method: 'POST',
        body: { listingId: id, eventType: 'published' },
      }).catch((e: unknown) => {
        if (import.meta.env.DEV) console.error('[email notify]', e)
      })
      showMsg(t('_admin_msg_republished'))
      setSelected(null)
      await fetchListings()
    }
    setActing(false)
  }

  const unpublishL = async (id: string) => {
    // "Stáhnout z nabídky" — soft unpublish, no reason required, notify owner
    if (!confirm('Stáhnout inzerát z nabídky? Majitel dostane email.')) return
    setActing(true)
    const { data, error } = await (supabase.from('listings') as any)
      .update({ status: 'rejected', rejection_reason: null })
      .eq('id', id)
      .select()
    if (error || !data || data.length === 0) {
      if (import.meta.env.DEV) console.error('Unpublish error:', error, data)
      showMsg(error ? mapError(error, t) : (t('_admin_error') + 'Oprávnění zamítnuto'))
    } else {
      // Fire-and-forget: notify owner
      supabase.functions.invoke('send-listing-email', {
        method: 'POST',
        body: { listingId: id, eventType: 'deleted' },
      }).catch((e: unknown) => {
        if (import.meta.env.DEV) console.error('[email notify]', e)
      })
      showMsg(t('_admin_msg_rejected'))
      setSelected(null)
      await fetchListings()
    }
    setActing(false)
  }

  if (isAdmin === false) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
      <div style={{ background: 'var(--c-surface)', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <p style={{ fontSize: 15, marginBottom: 16, color: 'var(--c-text)' }}>{t('_admin_no_access')}</p>
        <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', cursor: 'pointer', color: 'var(--c-text)' }}>{t('_admin_close')}</button>
      </div>
    </div>
  )

  if (isAdmin === null) return null

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'pending',   label: t('_admin_tab_pending'),   count: stats.pending,   color: 'var(--c-yellow)' },
    { key: 'published', label: t('_admin_tab_published'), count: stats.published, color: 'var(--c-green)' },
    { key: 'rejected',  label: t('_admin_tab_rejected'),  count: stats.rejected,  color: 'var(--c-red)' },
    { key: 'all',       label: t('_admin_tab_all'),       count: stats.total,     color: 'var(--c-muted)' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: window.innerWidth < 768 ? 0 : 16 }}>
      <div style={{
        width: '100%', maxWidth: 1100,
        height: window.innerWidth < 768 ? '100%' : '90vh',
        background: 'var(--c-bg)',
        borderRadius: window.innerWidth < 768 ? 0 : 16,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: window.innerWidth < 768 ? 'none' : '0 24px 64px rgba(0,0,0,0.35)',
      }}>

        {/* Header */}
        <div style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-accent)' }}>{t('_admin_panel')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }} style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: tab === t.key ? t.color : 'var(--c-bg)',
                  color: tab === t.key ? 'white' : 'var(--c-muted)',
                  fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {actionMsg && (
              <span style={{ fontSize: 12, color: 'var(--c-green)', background: 'color-mix(in srgb, var(--c-green) 20%, transparent)', padding: '4px 10px', borderRadius: 6 }}>
                {actionMsg}
              </span>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--c-bg)', cursor: 'pointer', fontSize: 14, color: 'var(--c-muted)' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* List — full width on mobile */}
          <div style={{
            width: isMobile ? '100%' : 340,
            borderRight: isMobile ? 'none' : '1px solid var(--c-border)',
            overflow: 'auto', flexShrink: 0, background: 'var(--c-surface)',
            display: isMobile && selected ? 'none' : 'block',
          }}>
            {loading && (
              <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #7c3aed', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}

            {!loading && listings.length === 0 && (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 }}>
                {t('_admin_empty')}
              </div>
            )}

            {!loading && listings.map(l => (
              <div key={l.id} onClick={() => { setSelected(l); setRejectReason('') }} style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--c-border)',
                cursor: 'pointer',
                background: selected?.id === l.id ? 'color-mix(in srgb, var(--c-accent) 8%, transparent)' : 'var(--c-surface)',
                borderLeft: `3px solid ${selected?.id === l.id ? 'var(--c-accent)' : 'transparent'}`,
                transition: 'all 0.1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {l.title}
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: STATUS_COLORS[l.status] + '22', color: STATUS_COLORS[l.status], fontWeight: 600, flexShrink: 0 }}>
                    {t(STATUS_LABELS[l.status])}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 3 }}>
                  {PROPERTY_TYPE_LABELS[l.property_type as PropertyType]} · {l.area_sqm} m² · {formatPrice(l.price_total_czk)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 2 }}>
                  {l.address_district} · {formatDate(l.created_at)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                  👤 {l.owner?.display_name ?? '—'} · {l.owner?.phone || t('_admin_no_phone')}
                </div>
              </div>
            ))}
          </div>

          {/* Detail */}
          {selected ? (
            <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Mobile back-to-list button */}
              {isMobile && (
                <button onClick={() => setSelected(null)}
                  style={{
                    alignSelf: 'flex-start', padding: '8px 14px', border: '1px solid var(--c-border)',
                    borderRadius: 8, background: 'var(--c-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--c-text)',
                  }}>
                  ← {t('_admin_select_prompt').replace('Vyber inzerát ze seznamu','Zpět na seznam').replace('Select a listing from the list','Back to list')}
                </button>
              )}

              {selected.image_paths.length > 0 && (
                <div style={{ height: 200, borderRadius: 10, overflow: 'hidden' }}>
                  <img src={getImageUrl(selected.image_paths[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.title}</h2>
                <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>
                  {selected.address_street}, {selected.address_district} · {formatPrice(selected.price_total_czk)} · {selected.area_sqm} m²
                </p>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--c-surface)', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: 13, lineHeight: 1.7, maxHeight: 160, overflow: 'auto', color: 'var(--c-text)' }}>
                {selected.description}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                {[
                  [t('_admin_detail_owner'),   selected.owner?.display_name ?? '—'],
                  [t('_admin_detail_phone'),   selected.owner?.phone || '—'],
                  [t('_admin_detail_type'),    PROPERTY_TYPE_LABELS[selected.property_type as PropertyType]],
                  [t('_admin_detail_area'),    `${selected.area_sqm} m²`],
                  [t('_admin_detail_price'),   formatPrice(selected.price_total_czk)],
                  [t('_admin_detail_status'),  t(STATUS_LABELS[selected.status])],
                  [t('_admin_detail_added'),   formatDate(selected.created_at)],
                  [t('_admin_detail_id'),      selected.id.slice(0, 8) + '...'],
                  [t('_admin_detail_photos'),  `${selected.image_paths.length} ks`],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '8px 10px', background: 'var(--c-surface)', borderRadius: 6, border: '1px solid var(--c-border)' }}>
                    <div style={{ color: 'var(--c-faint)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                    <div style={{ fontWeight: 500, color: 'var(--c-text)' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

                {(selected.status === 'pending_review') && (
                  <button
                    onClick={() => approve(selected.id)}
                    disabled={acting}
                    style={{ padding: '11px 0', background: acting ? 'color-mix(in srgb, var(--c-green) 60%, transparent)' : 'var(--c-green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: acting ? 'not-allowed' : 'pointer' }}
                  >
                    {acting ? t('_admin_approve_acting') : t('_admin_approve')}
                  </button>
                )}

                {(selected.status === 'rejected' || selected.status === 'deleted') && (
                  <button
                    onClick={() => republishL(selected.id)}
                    disabled={acting}
                    style={{ padding: '11px 0', background: acting ? 'color-mix(in srgb, var(--c-green) 60%, transparent)' : 'var(--c-green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: acting ? 'not-allowed' : 'pointer' }}
                  >
                    {acting ? t('_admin_republish_acting') : t('_admin_republish')}
                  </button>
                )}

                {selected.status !== 'rejected' && selected.status !== 'deleted' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder={t('_admin_reject_label')}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--c-surface)', color: 'var(--c-text)' }}
                    />
                    <button
                      onClick={() => reject(selected.id)}
                      disabled={acting || !rejectReason.trim()}
                      style={{ padding: '9px 16px', background: 'var(--c-red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: acting ? 'not-allowed' : 'pointer', opacity: !rejectReason.trim() ? 0.5 : 1 }}
                    >
                      {t('_admin_reject')}
                    </button>
                  </div>
                )}

                {selected.status === 'published' && (
                  <button
                    onClick={() => unpublishL(selected.id)}
                    disabled={acting}
                    style={{ padding: '11px 0', background: 'var(--c-yellow)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >
                    {t('_admin_unpublish')} · notifikace majiteli
                  </button>
                )}

                <div style={{ borderTop: '1px dashed var(--c-border)', paddingTop: 10 }}>
                  <button
                    onClick={() => deleteL(selected.id)}
                    disabled={acting}
                    style={{ padding: '9px 0', width: '100%', background: 'transparent', color: 'var(--c-red)', border: '1px solid color-mix(in srgb, var(--c-red) 40%, transparent)', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: acting ? 0.5 : 1 }}
                  >
                    🗑 {t('_admin_delete')} — bez notifikace, nevratné
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-faint)', fontSize: 14, flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 32 }}>👈</span>
              {t('_admin_select_prompt')}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}